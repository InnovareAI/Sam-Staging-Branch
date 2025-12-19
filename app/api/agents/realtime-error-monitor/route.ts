import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

const supabaseAdmin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_CHAT_WEBHOOK = process.env.GOOGLE_CHAT_WEBHOOK_URL;
const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY!;

interface ErrorCheck {
  name: string;
  critical: boolean;
  count: number;
  details?: string;
  autoFixed?: number;
}

/**
 * Resolve LinkedIn vanity slug to provider_id via Unipile API
 */
async function resolveVanityToProviderId(vanity: string, unipileAccountId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/users/${encodeURIComponent(vanity)}?account_id=${unipileAccountId}`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const profile = await response.json();
    return profile.provider_id || null;
  } catch {
    return null;
  }
}

/**
 * Auto-fix vanity resolution failures
 * When we detect "User ID does not match provider's expected format" errors,
 * automatically resolve vanities to provider_ids and reset to pending
 */
async function autoFixVanityFailures(supabase: ReturnType<typeof supabaseAdmin>): Promise<number> {
  console.log('🔧 Auto-fixing vanity resolution failures...');

  // Get failed items with vanity format errors (limit to 20 per run to avoid timeout)
  const { data: failedItems } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, campaign_id, error_message')
    .eq('status', 'failed')
    .ilike('error_message', '%does not match%')
    .limit(20);

  if (!failedItems || failedItems.length === 0) {
    console.log('   No vanity failures to fix');
    return 0;
  }

  let fixed = 0;

  for (const item of failedItems) {
    // Skip if already a provider_id
    if (item.linkedin_user_id?.startsWith('ACo') || item.linkedin_user_id?.startsWith('ACw')) {
      // Already resolved, just reset to pending
      await supabase
        .from('send_queue')
        .update({ status: 'pending', error_message: null, retry_count: 0 })
        .eq('id', item.id);
      fixed++;
      continue;
    }

    // Get campaign's LinkedIn account
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('linkedin_account_id')
      .eq('id', item.campaign_id)
      .single();

    if (!campaign) continue;

    // Get Unipile account ID
    let unipileAccountId: string | null = null;

    const { data: wsAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (wsAccount?.unipile_account_id) {
      unipileAccountId = wsAccount.unipile_account_id;
    } else {
      const { data: uuAccount } = await supabase
        .from('user_unipile_accounts')
        .select('unipile_account_id')
        .eq('id', campaign.linkedin_account_id)
        .single();
      unipileAccountId = uuAccount?.unipile_account_id || null;
    }

    if (!unipileAccountId) continue;

    // Resolve vanity to provider_id
    const providerId = await resolveVanityToProviderId(item.linkedin_user_id, unipileAccountId);

    if (providerId) {
      // Update queue item with resolved provider_id and reset to pending
      await supabase
        .from('send_queue')
        .update({
          linkedin_user_id: providerId,
          status: 'pending',
          error_message: null,
          retry_count: 0
        })
        .eq('id', item.id);

      console.log(`   ✅ Resolved ${item.linkedin_user_id} → ${providerId}`);
      fixed++;
    }
  }

  console.log(`🔧 Auto-fixed ${fixed}/${failedItems.length} vanity failures`);
  return fixed;
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
    // URGENT FIX (Dec 19): ONLY report actual errors (error_message NOT NULL)
    // Rate limits and network failures have NULL error_message (silent retry)
    const { data: failedSends, error: failedError } = await supabase
      .from('send_queue')
      .select('id, campaign_id, error_message, updated_at')
      .eq('status', 'failed')
      .not('error_message', 'is', null) // CRITICAL: Skip NULL (silent retries)
      .gte('updated_at', fifteenMinAgo.toISOString());

    // Filter out auto-cleaned items to avoid noise
    const realFailures = (failedSends || []).filter(f => {
      const msg = (f.error_message || '').toLowerCase();
      // Ignore auto-fix cleanups
      if (msg.includes('stale') || msg.includes('expired') || msg.includes('auto-cleaned')) {
        return false;
      }
      return true;
    });

    if (!failedError && realFailures.length > 0) {
      // Check if any failures are vanity resolution errors - auto-fix them
      const vanityErrors = realFailures.filter(f =>
        f.error_message?.includes('does not match')
      );

      let autoFixed = 0;
      if (vanityErrors.length > 0) {
        console.log(`🔧 Detected ${vanityErrors.length} vanity resolution errors - auto-fixing...`);
        autoFixed = await autoFixVanityFailures(supabase);
      }

      // Only report remaining failures (subtract auto-fixed)
      const remainingCount = realFailures.length - autoFixed;
      if (remainingCount > 0) {
        errors.push({
          name: 'Failed Sends (15min)',
          critical: remainingCount >= 3,
          count: remainingCount,
          details: realFailures.slice(0, 3).map(f => f.error_message).join('; '),
          autoFixed: autoFixed > 0 ? autoFixed : undefined
        });
      } else if (autoFixed > 0) {
        // All errors were auto-fixed - report as success
        console.log(`✅ All ${autoFixed} vanity errors auto-fixed`);
      }
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

    // Always send status to Google Chat
    if (GOOGLE_CHAT_WEBHOOK) {
      let alertMessage: { text: string };

      if (criticalErrors.length > 0) {
        alertMessage = {
          text: `🚨 *CRITICAL CAMPAIGN ERRORS*\n\n${criticalErrors.map(e =>
            `❌ *${e.name}*: ${e.count} issues\n   ${e.details || ''}`
          ).join('\n\n')}\n\n_Detected at ${now.toISOString()}_`
        };
      } else if (warnings.length > 0) {
        alertMessage = {
          text: `⚠️ *Campaign Monitor: ${warnings.length} Warning(s)*\n\n${warnings.map(w =>
            `• *${w.name}*: ${w.count}${w.autoFixed ? ` (${w.autoFixed} auto-fixed)` : ''}\n   ${w.details || ''}`
          ).join('\n\n')}\n\n_Checked at ${now.toISOString()}_`
        };
      } else {
        alertMessage = {
          text: `✅ *Campaign Monitor: All Systems OK*\n\nNo critical errors or warnings detected.\n\n_Checked at ${now.toISOString()}_`
        };
      }

      try {
        await fetch(GOOGLE_CHAT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertMessage)
        });
        console.log('📨 Status sent to Google Chat');
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
