import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { VALID_CONNECTION_STATUSES } from '@/lib/constants/connection-status';

/**
 * Create LinkedIn Search Job (Async)
 *
 * Creates a background job for large LinkedIn searches
 * Returns job_id immediately
 * Frontend can subscribe to Supabase Realtime for progress updates
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, workspaceId } = await verifyAuth(request);

    const body = await request.json();
    const {
      search_criteria,
      search_type = 'linkedin',
      target_count = 1000
    } = body;

    // Get LinkedIn account from workspace_accounts table - ONLY user's own accounts
    const { rows: linkedinAccounts } = await pool.query(`
      SELECT unipile_account_id, account_name, account_identifier
      FROM workspace_accounts
      WHERE workspace_id = $1
      AND user_id = $2
      AND account_type = 'linkedin'
      AND connection_status = ANY($3)
    `, [workspaceId, userId, VALID_CONNECTION_STATUSES]);

    console.log('🔵 LinkedIn accounts found:', linkedinAccounts?.length || 0);

    if (!linkedinAccounts || linkedinAccounts.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active LinkedIn account found. Please connect your LinkedIn account first.',
        action: 'connect_linkedin'
      }, { status: 400 });
    }

    const linkedinAccount = linkedinAccounts[0];
    console.log('✅ Using LinkedIn account:', linkedinAccount.account_name || linkedinAccount.account_identifier);

    // Auto-detect LinkedIn capabilities (Sales Navigator, Recruiter, etc.)
    let api = 'classic';
    try {
      // UNIPILE_DSN format: "api6.unipile.com:13670" - already includes domain and port
      const accountInfoUrl = `https://${process.env.UNIPILE_DSN}/api/v1/accounts/${linkedinAccount.unipile_account_id}`;
      const accountInfoResponse = await fetch(accountInfoUrl, {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY!,
          'Accept': 'application/json'
        }
      });

      if (accountInfoResponse.ok) {
        const accountInfo = await accountInfoResponse.json();
        const premiumFeatures = accountInfo.connection_params?.im?.premiumFeatures || [];

        if (premiumFeatures.includes('recruiter')) {
          api = 'recruiter';
        } else if (premiumFeatures.includes('sales_navigator')) {
          api = 'sales_navigator';
        }
      }
    } catch (error) {
      console.warn('Could not detect LinkedIn capabilities, using classic');
    }

    // Create job in database
    const { rows: jobRows } = await pool.query(`
      INSERT INTO prospect_search_jobs (
        user_id, workspace_id, search_criteria, search_type,
        search_source, status, progress_current, progress_total
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId,
      workspaceId,
      JSON.stringify({
        ...search_criteria,
        api,
        limit: target_count
      }),
      search_type,
      api,
      'queued',
      0,
      target_count
    ]);

    if (!jobRows || jobRows.length === 0) {
      console.error('Failed to create job');
      return NextResponse.json({
        success: false,
        error: 'Failed to create search job'
      }, { status: 500 });
    }

    const job = jobRows[0];
    console.log(`✅ Created job ${job.id} for user ${userId}`);

    // Trigger background function (fire and forget)
    const backgroundFunctionUrl = process.env.NODE_ENV === 'production'
      ? `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/.netlify/functions/process-linkedin-search-background`
      : 'http://localhost:8888/.netlify/functions/process-linkedin-search-background';

    fetch(backgroundFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        search_criteria: {
          ...search_criteria,
          api
        },
        account_id: linkedinAccount.unipile_account_id,
        user_id: userId
      })
    }).catch(err => {
      console.error('Failed to trigger background function:', err);
      // Don't fail the request - job is queued, can be retried
    });

    console.log(`🚀 Triggered background function for job ${job.id}`);

    // Return immediately
    return NextResponse.json({
      success: true,
      job_id: job.id,
      status: 'queued',
      message: `Search queued for ${target_count} prospects. Subscribe to job updates via Realtime.`,
      metadata: {
        api: api,
        max_results: api === 'classic' ? 1000 : 2500,
        estimated_time_seconds: Math.ceil(target_count / 100) * 3 // ~3 sec per page
      }
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('❌ Create job error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create search job'
    }, { status: 500 });
  }
}

/**
 * GET - Check job status
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const job_id = searchParams.get('job_id');

    if (!job_id) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 });
    }

    // Get job status
    const { rows: jobRows } = await pool.query(`
      SELECT * FROM prospect_search_jobs
      WHERE id = $1 AND user_id = $2
    `, [job_id, userId]);

    if (!jobRows || jobRows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = jobRows[0];

    // Get result count
    const { rows: countRows } = await pool.query(`
      SELECT COUNT(*) as count FROM prospect_search_results
      WHERE job_id = $1
    `, [job_id]);

    const count = parseInt(countRows[0]?.count || '0');

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: {
          current: job.progress_current,
          total: job.progress_total,
          percentage: job.progress_total > 0
            ? Math.round((job.progress_current / job.progress_total) * 100)
            : 0
        },
        results_count: count,
        started_at: job.started_at,
        completed_at: job.completed_at,
        error_message: job.error_message
      }
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('❌ Get job status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job status'
    }, { status: 500 });
  }
}
