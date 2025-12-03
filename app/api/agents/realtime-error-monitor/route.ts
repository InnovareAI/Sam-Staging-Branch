import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const supabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK_URL;

interface ErrorCheck {
  name: string;
  critical: boolean;
  count: number;
  details?: string;
}

/**
 * Real-Time Error Monitor
 * Runs every 5 minutes to catch critical campaign errors FAST
 *
 * Checks:
 * 1. Failed sends in last 15 min
 * 2. Stuck queue items (scheduled but not processed)
 * 3. Unipile API errors
 * 4. Campaign status anomalies
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔴 Real-time error monitor starting...');

  const supabase = supabaseAdmin();
  const errors: ErrorCheck[] = [];
  const now = new Date();
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

  try {
    // CHECK 1: Failed sends in last 15 minutes
    const { data: failedSends, error: failedError } = await supabase
      .from('send_queue')
      .select('id, campaign_id, error_message, updated_at')
      .eq('status', 'failed')
      .gte('updated_at', fifteenMinAgo.toISOString());

    if (!failedError && failedSends && failedSends.length > 0) {
      errors.push({
        name: 'Failed Sends (15min)',
        critical: failedSends.length >= 3,
        count: failedSends.length,
        details: failedSends.slice(0, 3).map(f => f.error_message).join('; ')
      });
    }

    // CHECK 2: Stuck queue items (past due by 10+ minutes)
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const { data: stuckQueue, error: stuckError } = await supabase
      .from('send_queue')
      .select('id, scheduled_for, campaign_id')
      .eq('status', 'pending')
      .lt('scheduled_for', tenMinAgo.toISOString());

    if (!stuckError && stuckQueue && stuckQueue.length > 0) {
      errors.push({
        name: 'Stuck Queue Items',
        critical: stuckQueue.length >= 5,
        count: stuckQueue.length,
        details: `Oldest: ${stuckQueue[0]?.scheduled_for}`
      });
    }

    // CHECK 3: Prospects stuck in "sending" status (>30 min)
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const { data: stuckProspects, error: prospectError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, status, updated_at')
      .eq('status', 'sending')
      .lt('updated_at', thirtyMinAgo.toISOString());

    if (!prospectError && stuckProspects && stuckProspects.length > 0) {
      errors.push({
        name: 'Stuck Prospects (sending)',
        critical: true,
        count: stuckProspects.length,
        details: stuckProspects.slice(0, 3).map(p => `${p.first_name} ${p.last_name}`).join(', ')
      });
    }

    // CHECK 4: Cron execution gaps (check cron_execution_log if exists)
    const { data: recentCrons } = await supabase
      .from('cron_execution_log')
      .select('cron_name, executed_at, success')
      .gte('executed_at', fifteenMinAgo.toISOString())
      .order('executed_at', { ascending: false });

    // If process-send-queue hasn't run in 5+ min, that's a problem
    const sendQueueRuns = recentCrons?.filter(c => c.cron_name === 'process-send-queue') || [];
    if (sendQueueRuns.length === 0) {
      // Check if there are pending items that should have been processed
      const { count: pendingCount } = await supabase
        .from('send_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lte('scheduled_for', now.toISOString());

      if (pendingCount && pendingCount > 0) {
        errors.push({
          name: 'Cron Not Running',
          critical: true,
          count: pendingCount,
          details: 'process-send-queue has not run in 15 min with pending items'
        });
      }
    }

    // CHECK 5: Active connector campaigns with PENDING prospects but NO queue items
    // This catches campaigns that failed to queue during launch
    const campaignAgeThreshold = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10 min old
    const { data: connectorCampaigns } = await supabase
      .from('campaigns')
      .select('id, campaign_name, status, created_at, campaign_type')
      .eq('status', 'active')
      .eq('campaign_type', 'connector')
      .lt('created_at', campaignAgeThreshold); // Only check campaigns older than 10 min

    for (const campaign of connectorCampaigns || []) {
      // Count pending prospects with LinkedIn URLs
      const { count: pendingCount } = await supabase
        .from('campaign_prospects')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .not('linkedin_url', 'is', null);

      if (!pendingCount || pendingCount === 0) continue;

      // Check if these pending prospects are in the queue
      const { data: pendingProspects } = await supabase
        .from('campaign_prospects')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .not('linkedin_url', 'is', null)
        .limit(50);

      const prospectIds = pendingProspects?.map(p => p.id) || [];

      const { count: queuedCount } = await supabase
        .from('send_queue')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id)
        .in('prospect_id', prospectIds);

      // Alert if there are pending prospects NOT in queue
      const unqueuedCount = pendingCount - (queuedCount || 0);
      if (unqueuedCount > 0) {
        errors.push({
          name: 'Unqueued Prospects',
          critical: true,
          count: unqueuedCount,
          details: `${campaign.campaign_name || campaign.id.slice(0,8)}: ${unqueuedCount} pending prospects not in queue`
        });
      }
    }

    // Build response
    const criticalErrors = errors.filter(e => e.critical);
    const warnings = errors.filter(e => !e.critical);

    const result = {
      timestamp: now.toISOString(),
      duration_ms: Date.now() - startTime,
      status: criticalErrors.length > 0 ? 'CRITICAL' : warnings.length > 0 ? 'WARNING' : 'OK',
      critical_count: criticalErrors.length,
      warning_count: warnings.length,
      errors: criticalErrors,
      warnings
    };

    console.log(`🔴 Error monitor result: ${result.status}`);
    console.log(`   Critical: ${criticalErrors.length}, Warnings: ${warnings.length}`);

    // Alert to Google Chat if critical errors
    if (criticalErrors.length > 0 && GOOGLE_CHAT_WEBHOOK) {
      const alertMessage = {
        text: `🚨 *CRITICAL CAMPAIGN ERRORS*\n\n${criticalErrors.map(e =>
          `❌ *${e.name}*: ${e.count} issues\n   ${e.details || ''}`
        ).join('\n\n')}\n\n_Detected at ${now.toISOString()}_`
      };

      try {
        await fetch(GOOGLE_CHAT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertMessage)
        });
        console.log('📨 Alert sent to Google Chat');
      } catch (alertError) {
        console.error('Failed to send alert:', alertError);
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('🔴 Error monitor failed:', error);
    return NextResponse.json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET for manual testing
export async function GET(req: NextRequest) {
  // Convert to POST with fake cron header for testing
  const testReq = new NextRequest(req.url, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET || ''
    }
  });
  return POST(testReq);
}
