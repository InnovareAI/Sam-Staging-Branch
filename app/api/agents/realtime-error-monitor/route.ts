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
    // SMART FILTER (Dec 17): Ignore auto-cleaned stale items (error contains "stale" or "expired")
    const { data: failedSends, error: failedError } = await supabase
      .from('send_queue')
      .select('id, campaign_id, error_message, updated_at')
      .eq('status', 'failed')
      .gte('updated_at', fifteenMinAgo.toISOString());

    // Filter out auto-cleaned items to avoid noise
    const realFailures = (failedSends || []).filter(f => {
      const msg = (f.error_message || '').toLowerCase();
      // Ignore auto-fix cleanups
      if (msg.includes('stale') || msg.includes('expired') || msg.includes('auto-cleaned')) {
        return false;
      }
      // Ignore rate limit delays (expected behavior)
      if (msg.includes('rate limit') || msg.includes('too many requests')) {
        return false;
      }
      return true;
    });

    if (!failedError && realFailures.length > 0) {
      errors.push({
        name: 'Failed Sends (15min)',
        critical: realFailures.length >= 3,
        count: realFailures.length,
        details: realFailures.slice(0, 3).map(f => f.error_message).join('; ')
      });
    }

    // CHECK 2: Stuck queue items - DISABLED
    // With 2-min spacing per account and rate limiting, items legitimately wait many hours.
    // Example: 50 prospects × 2-min spacing = 100 minutes minimum, plus account scheduling.
    // The daily health check (which runs at 6 AM) will catch truly stuck items.
    // This real-time check caused too many false alarms and has been disabled.

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

    // CHECK 4: Cron execution gaps - DISABLED
    // The cron_execution_log table isn't reliably populated, and with rate limiting
    // items legitimately wait for spacing. Instead of checking cron execution,
    // we rely on CHECK 2 (stuck items 2+ hours old) to detect actual problems.
    //
    // If you want to re-enable this check, ensure:
    // 1. cron_execution_log table exists and is populated by all cron jobs
    // 2. Threshold accounts for rate limiting (items can wait hours normally)

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

      // FIX (Dec 18): Get ALL queue entries for campaign and count locally
      // Don't use .in() with large arrays - it fails silently
      const { data: pendingProspects } = await supabase
        .from('campaign_prospects')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .not('linkedin_url', 'is', null);

      const { data: queueEntries } = await supabase
        .from('send_queue')
        .select('prospect_id')
        .eq('campaign_id', campaign.id);

      // Count how many pending prospects are in queue
      const queuedIds = new Set((queueEntries || []).map(q => q.prospect_id));
      let queuedCount = 0;
      for (const p of pendingProspects || []) {
        if (queuedIds.has(p.id)) queuedCount++;
      }

      // Alert if there are pending prospects NOT in queue
      const unqueuedCount = (pendingProspects?.length || 0) - queuedCount;
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
