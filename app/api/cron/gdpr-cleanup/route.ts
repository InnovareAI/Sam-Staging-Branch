/**
 * GDPR Automated Data Cleanup Cron Job
 * Automatically deletes prospects past their retention period
 * Date: October 31, 2025
 *
 * Schedule: Daily at 2 AM UTC
 * Netlify: Configure in netlify.toml or Netlify dashboard
 */

import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.NETLIFY_CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧹 Starting GDPR automated cleanup job...');

    // Use service role for cron jobs (no user session needed)
    // Stats tracking
    const stats = {
      start_time: new Date().toISOString(),
      prospects_deleted: 0,
      workspaces_processed: 0,
      deletion_requests_executed: 0,
      retention_dates_updated: 0,
      errors: [] as string[],
    };

    // =====================================================================
    // Step 1: Execute approved deletion requests that are due
    // =====================================================================

    console.log('📝 Step 1: Processing approved deletion requests...');

    try {
      const { data: approvedRequests, error: fetchError } = await supabase
        .from('gdpr_deletion_requests')
        .select('*')
        .eq('status', 'approved')
        .lte('scheduled_execution_date', new Date().toISOString())
        .limit(100); // Process in batches

      if (fetchError) {
        stats.errors.push(`Fetch deletion requests error: ${fetchError.message}`);
      } else if (approvedRequests && approvedRequests.length > 0) {
        console.log(`Found ${approvedRequests.length} approved deletion requests to execute`);

        for (const request of approvedRequests) {
          try {
            const { data: result, error: executeError } = await supabase.rpc(
              'execute_gdpr_deletion',
              {
                p_request_id: request.id,
                p_executed_by: null, // System execution
              }
            );

            if (executeError) {
              stats.errors.push(
                `Failed to execute deletion request ${request.id}: ${executeError.message}`
              );
            } else {
              stats.deletion_requests_executed++;
              console.log(`✅ Executed deletion request ${request.id}`);
            }
          } catch (err) {
            stats.errors.push(
              `Exception executing deletion request ${request.id}: ${
                err instanceof Error ? err.message : 'Unknown'
              }`
            );
          }
        }
      } else {
        console.log('No approved deletion requests to execute');
      }
    } catch (err) {
      stats.errors.push(
        `Step 1 error: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }

    // =====================================================================
    // Step 2: Auto-delete prospects past retention period
    // =====================================================================

    console.log('🗑️  Step 2: Auto-deleting expired prospects...');

    try {
      const { data: deleteResults, error: deleteError } = await supabase.rpc(
        'auto_delete_expired_prospects',
        {
          p_batch_size: 100,
        }
      );

      if (deleteError) {
        stats.errors.push(`Auto-delete error: ${deleteError.message}`);
      } else if (deleteResults && deleteResults.length > 0) {
        for (const result of deleteResults) {
          stats.prospects_deleted += result.deleted_count;
          stats.workspaces_processed++;
          console.log(
            `✅ Deleted ${result.deleted_count} expired prospects from workspace ${result.workspace_id}`
          );
        }
      } else {
        console.log('No expired prospects to delete');
      }
    } catch (err) {
      stats.errors.push(
        `Step 2 error: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }

    // =====================================================================
    // Step 3: Update scheduled deletion dates for prospects without one
    // =====================================================================

    console.log('📅 Step 3: Updating scheduled deletion dates...');

    try {
      const { data: updateResults, error: updateError } = await supabase.rpc(
        'mark_prospects_for_deletion'
      );

      if (updateError) {
        stats.errors.push(`Mark for deletion error: ${updateError.message}`);
      } else if (updateResults && updateResults.length > 0) {
        stats.retention_dates_updated = updateResults.length;
        console.log(
          `✅ Updated ${updateResults.length} prospects with scheduled deletion dates`
        );
      } else {
        console.log('No prospects need deletion date updates');
      }
    } catch (err) {
      stats.errors.push(
        `Step 3 error: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }

    // =====================================================================
    // Step 4: Cleanup old PII access logs (keep last 90 days)
    // =====================================================================

    console.log('🧹 Step 4: Cleaning up old PII access logs...');

    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { error: logCleanupError } = await supabase
        .from('pii_access_log')
        .delete()
        .lt('accessed_at', ninetyDaysAgo.toISOString());

      if (logCleanupError) {
        stats.errors.push(`PII log cleanup error: ${logCleanupError.message}`);
      } else {
        console.log('✅ Cleaned up old PII access logs');
      }
    } catch (err) {
      stats.errors.push(
        `Step 4 error: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }

    // =====================================================================
    // Summary
    // =====================================================================

    stats.end_time = new Date().toISOString();

    const summary = {
      success: stats.errors.length === 0,
      stats,
      message:
        stats.errors.length === 0
          ? 'GDPR cleanup completed successfully'
          : 'GDPR cleanup completed with errors',
    };

    console.log('✅ GDPR cleanup job complete');
    console.log(`   - Deletion requests executed: ${stats.deletion_requests_executed}`);
    console.log(`   - Prospects deleted: ${stats.prospects_deleted}`);
    console.log(`   - Workspaces processed: ${stats.workspaces_processed}`);
    console.log(`   - Retention dates updated: ${stats.retention_dates_updated}`);
    console.log(`   - Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.error('❌ Errors encountered:');
      stats.errors.forEach((err, idx) => {
        console.error(`   ${idx + 1}. ${err}`);
      });
    }

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error('❌ GDPR cleanup job fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
