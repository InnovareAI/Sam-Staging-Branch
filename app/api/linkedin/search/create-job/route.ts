import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * Create LinkedIn Search Job (Async)
 *
 * Creates a background job for large LinkedIn searches
 * Returns job_id immediately
 * Frontend can subscribe to Supabase Realtime for progress updates
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const session = { user };

    const body = await request.json();
    const {
      search_criteria,
      search_type = 'linkedin',
      target_count = 1000
    } = body;

    // Get user's workspace
    const { data: userProfile } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', session.user.id)
      .single();

    const workspaceId = userProfile?.current_workspace_id;
    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 400 });
    }

    // Get LinkedIn account from workspace_accounts table - ONLY user's own accounts
    const { data: linkedinAccounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, account_name, account_identifier')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id) // CRITICAL: Only user's own accounts
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected');

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
      const accountInfoResponse = await fetch(
        `https://${process.env.UNIPILE_DSN}.unipile.com:13443/api/v1/accounts/${linkedinAccount.unipile_account_id}`,
        {
          headers: {
            'X-API-KEY': process.env.UNIPILE_API_KEY!,
            'Accept': 'application/json'
          }
        }
      );

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
    const { data: job, error: jobError } = await supabase
      .from('prospect_search_jobs')
      .insert({
        user_id: session.user.id,
        workspace_id: workspaceId,
        search_criteria: {
          ...search_criteria,
          api,
          limit: target_count
        },
        search_type: search_type,
        search_source: api,
        status: 'queued',
        progress_current: 0,
        progress_total: target_count
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create job:', jobError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create search job'
      }, { status: 500 });
    }

    console.log(`✅ Created job ${job.id} for user ${session.user.id}`);

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
        user_id: session.user.id
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
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const job_id = searchParams.get('job_id');

    if (!job_id) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 });
    }

    // Get job status
    const { data: job, error } = await supabase
      .from('prospect_search_jobs')
      .select('*')
      .eq('id', job_id)
      .eq('user_id', user.id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get result count
    const { count } = await supabase
      .from('prospect_search_results')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', job_id);

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
        results_count: count || 0,
        started_at: job.started_at,
        completed_at: job.completed_at,
        error_message: job.error_message
      }
    });

  } catch (error) {
    console.error('❌ Get job status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job status'
    }, { status: 500 });
  }
}
