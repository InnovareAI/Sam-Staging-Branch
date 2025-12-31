import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { airtableService } from '@/lib/airtable';
import { normalizeCompanyName } from '@/lib/prospect-normalization';
import { extractLinkedInSlug, getBestLinkedInIdentifier } from '@/lib/linkedin-utils';
import { resolveToProviderId } from '@/lib/resolve-linkedin-id';

/**
 * FAST Queue-Based Campaign Execution
 *
 * This endpoint ONLY creates queue records - validation happens in cron processor.
 * Returns in <5 seconds even with 50+ prospects.
 *
 * POST /api/campaigns/direct/send-connection-requests-fast
 * Body: { campaignId: string }
 */

export const maxDuration = 60;

// Public holidays (US 2025-2026)
const PUBLIC_HOLIDAYS = [
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26', '2025-06-19',
  '2025-07-04', '2025-09-01', '2025-11-11', '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19'
];

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function isPublicHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return PUBLIC_HOLIDAYS.includes(dateStr);
}

export async function POST(req: NextRequest) {
  try {
    // Check if this is an internal trigger (cron or activation)
    const internalTrigger = req.headers.get('x-internal-trigger');
    const isCronTrigger = internalTrigger === 'cron-pending-prospects';
    const isActivationTrigger = internalTrigger === 'campaign-activation';
    const isInternalCall = isCronTrigger || isActivationTrigger;

    let userId: string | null = null;
    let userEmail: string | null = null;

    if (!isInternalCall) {
      // User-initiated request: require authentication
      const authResult = await verifyAuth(req);
      userId = authResult.userId;
      userEmail = authResult.userEmail;
    } else {
      console.log(`🤖 Internal trigger (${internalTrigger}) - bypassing user auth`);
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    console.log(`🚀 FAST queue creation for campaign: ${campaignId} (${isInternalCall ? internalTrigger : `user: ${userEmail}`})`);

    // 1. Fetch campaign - use admin client for cron, or user client for RLS check
    // CRITICAL FIX (Dec 4): Also fetch connection_message column AND linkedin_config
    // CRITICAL FIX (Dec 10): Also fetch linkedin_account_id to validate it exists
    // FIX (Dec 18): Don't join workspace_accounts - fetch LinkedIn account separately
    const campaignResult = await pool.query(
      `SELECT id, campaign_name, name, campaign_type, message_templates,
              workspace_id, draft_data, linkedin_config, connection_message,
              linkedin_account_id
       FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      console.error('Campaign not found or access denied');
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
    }

    const campaign = campaignResult.rows[0];

    // CRITICAL FIX (Dec 20): Prevent double-sending by rejecting messenger campaigns
    // Messenger campaigns must use /api/campaigns/direct/send-messages-queued
    if (campaign.campaign_type === 'messenger') {
      console.warn(`⚠️ Blocked incorrect endpoint usage for messenger campaign: ${campaign.campaign_name || campaign.name}`);
      return NextResponse.json({
        error: 'Incorrect endpoint for Messenger campaign',
        details: 'Messenger campaigns must use /api/campaigns/direct/send-messages-queued. This endpoint initiates connection requests which are not for messenger campaigns.',
        suggestion: 'Use the correct API endpoint for messenger campaigns.'
      }, { status: 400 });
    }

    // CRITICAL VALIDATION (Dec 10): LinkedIn account MUST be configured
    // This prevents campaigns from silently failing when linkedin_account_id is null
    if (!campaign.linkedin_account_id) {
      console.error('❌ CRITICAL: Campaign has no LinkedIn account configured!');
      console.error(`   Campaign ID: ${campaignId}`);
      console.error(`   Campaign Name: ${campaign.campaign_name || campaign.name || 'Unknown'}`);
      return NextResponse.json({
        error: 'LinkedIn account not configured',
        details: 'This campaign has no LinkedIn account selected. Please edit the campaign and select a LinkedIn account before launching.',
        campaignId,
        campaignName: campaign.campaign_name || campaign.name
      }, { status: 400 });
    }

    // CRITICAL VALIDATION (Dec 10): Verify the LinkedIn account exists and is connected
    // FIX (Dec 18): Check BOTH workspace_accounts AND user_unipile_accounts
    let linkedinAccount: { id: string; unipile_account_id: string; account_name: string; connection_status: string } | null = null;

    // First try workspace_accounts
    const wsAccountResult = await pool.query(
      `SELECT id, unipile_account_id, account_name, connection_status
       FROM workspace_accounts WHERE id = $1`,
      [campaign.linkedin_account_id]
    );

    if (wsAccountResult.rows.length > 0) {
      linkedinAccount = wsAccountResult.rows[0];
    } else {
      // Fallback to user_unipile_accounts
      const uniAccountResult = await pool.query(
        `SELECT id, unipile_account_id, account_name, connection_status
         FROM user_unipile_accounts WHERE id = $1`,
        [campaign.linkedin_account_id]
      );

      if (uniAccountResult.rows.length > 0) {
        linkedinAccount = uniAccountResult.rows[0];
        console.log('✅ Found LinkedIn account in user_unipile_accounts:', linkedinAccount.account_name);
      }
    }

    if (!linkedinAccount) {
      console.error('❌ CRITICAL: LinkedIn account not found in workspace_accounts OR user_unipile_accounts!');
      console.error(`   linkedin_account_id: ${campaign.linkedin_account_id}`);
      return NextResponse.json({
        error: 'LinkedIn account not found',
        details: 'The configured LinkedIn account no longer exists. Please select a different account.',
        campaignId
      }, { status: 400 });
    }

    // Accept both 'connected' and 'active' as valid statuses
    if (linkedinAccount.connection_status !== 'connected' && linkedinAccount.connection_status !== 'active') {
      console.error(`❌ LinkedIn account is ${linkedinAccount.connection_status}, not connected/active`);
      return NextResponse.json({
        error: 'LinkedIn account disconnected',
        details: `The account "${linkedinAccount.account_name}" is ${linkedinAccount.connection_status}. Please reconnect it in Settings → LinkedIn Accounts.`,
        campaignId
      }, { status: 400 });
    }

    console.log(`✅ LinkedIn account validated: ${linkedinAccount.account_name} (${linkedinAccount.unipile_account_id})`);

    // 1.5. CRITICAL FIX: Transfer draft_data.csvData to campaign_prospects if needed
    // This handles the case where drafts were created with prospects stored in draft_data
    // but never transferred to campaign_prospects table
    const draftData = campaign.draft_data as { csvData?: any[] } | null;
    if (draftData?.csvData && draftData.csvData.length > 0) {
      // Check if campaign_prospects is empty for this campaign
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1`,
        [campaignId]
      );

      if (parseInt(countResult.rows[0].count) === 0) {
        console.log(`📦 Transferring ${draftData.csvData.length} prospects from draft_data to campaign_prospects`);

        // Map draft_data.csvData to campaign_prospects format
        for (const p of draftData.csvData) {
          const linkedinUrl = p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url;
          if (!linkedinUrl) continue;

          await pool.query(
            `INSERT INTO campaign_prospects (
              campaign_id, workspace_id, first_name, last_name, linkedin_url,
              provider_id, company_name, title, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT DO NOTHING`,
            [
              campaignId,
              campaign.workspace_id,
              p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
              p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
              linkedinUrl,
              p.provider_id || p.providerId || null,
              p.company || p.organization || null,
              p.title || p.job_title || null,
              'pending',
              new Date().toISOString()
            ]
          );
        }
        console.log(`✅ Transferred prospects to campaign_prospects`);
      }
    }

    // 2. Fetch prospects ready for outreach (limit 50)
    // CRITICAL FIX (Dec 8): Include BOTH 'pending' AND 'approved' statuses
    // Prospects go through approval workflow → status becomes 'approved'
    // We need to queue approved prospects, not just pending ones
    const prospectsResult = await pool.query(
      `SELECT * FROM campaign_prospects
       WHERE campaign_id = $1
         AND status IN ('pending', 'approved')
         AND linkedin_url IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 50`,
      [campaignId]
    );

    const prospects = prospectsResult.rows;

    if (!prospects || prospects.length === 0) {
      console.log('✅ No pending prospects');
      return NextResponse.json({ success: true, queued: 0, message: 'No pending prospects' });
    }

    // 2.5: Check which prospects are already in queue (to avoid duplicates)
    const prospectIds = prospects.map(p => p.id);
    const existingQueueResult = await pool.query(
      `SELECT prospect_id FROM send_queue WHERE campaign_id = $1 AND prospect_id = ANY($2)`,
      [campaignId, prospectIds]
    );

    const existingProspectIds = new Set(existingQueueResult.rows.map(q => q.prospect_id));
    const newProspects = prospects.filter(p => !existingProspectIds.has(p.id));
    const skippedCount = prospects.length - newProspects.length;

    if (skippedCount > 0) {
      console.log(`⚠️ Skipping ${skippedCount} prospects already in queue`);
    }

    if (newProspects.length === 0) {
      console.log('✅ All prospects already in queue');
      return NextResponse.json({
        success: true,
        queued: 0,
        skipped: skippedCount,
        message: 'All prospects already queued'
      });
    }

    console.log(`📊 Queueing ${newProspects.length} NEW prospects (${skippedCount} already queued)...`);

    // 3. Create queue records
    // LIMITS: 25 per day per workspace, spaced within business hours (8 AM - 6 PM UTC)
    const MAX_PER_DAY = 25;
    const BUSINESS_START_HOUR = 8;  // 8 AM UTC
    const BUSINESS_END_HOUR = 18;   // 6 PM UTC

    // RANDOMIZED SCHEDULING (Dec 11, 2025)
    // Instead of fixed intervals, use random 20-45 minute gaps
    // This looks more human-like and avoids LinkedIn detection
    const MIN_SPACING_MINUTES = 20;
    const MAX_SPACING_MINUTES = 45;

    // Pre-calculate random intervals for each prospect
    const getRandomInterval = () => MIN_SPACING_MINUTES + Math.floor(Math.random() * (MAX_SPACING_MINUTES - MIN_SPACING_MINUTES + 1));

    // CRITICAL FIX (Dec 4): Check ALL possible locations for connection message
    // Different campaign types store messages in different places:
    // 1. message_templates.connection_request (standard)
    // 2. connection_message column (direct column on campaigns table)
    // 3. linkedin_config.connection_message (Charissa/LinkedIn-only campaigns)
    // 4. draft_data.connectionRequestMessage (wizard drafts)
    const linkedinConfig = campaign.linkedin_config as { connection_message?: string } | null;
    const draftDataMsg = (campaign.draft_data as { connectionRequestMessage?: string } | null);

    const connectionMessage =
      campaign.message_templates?.connection_request ||
      campaign.connection_message ||
      linkedinConfig?.connection_message ||
      draftDataMsg?.connectionRequestMessage ||
      null;

    if (!connectionMessage) {
      console.error('❌ CRITICAL: No connection message found in campaign!');
      console.error('  - message_templates.connection_request:', campaign.message_templates?.connection_request);
      console.error('  - connection_message column:', campaign.connection_message);
      console.error('  - linkedin_config.connection_message:', linkedinConfig?.connection_message);
      console.error('  - draft_data.connectionRequestMessage:', draftDataMsg?.connectionRequestMessage);
      return NextResponse.json({
        error: 'Campaign has no connection message configured. Please edit the campaign and add a connection request message.',
        details: 'No message found in message_templates, connection_message column, linkedin_config, or draft_data'
      }, { status: 400 });
    }

    console.log('✅ Using connection message from:',
      campaign.message_templates?.connection_request ? 'message_templates.connection_request' :
        campaign.connection_message ? 'connection_message column' :
          linkedinConfig?.connection_message ? 'linkedin_config' : 'draft_data');

    // A/B TESTING REMOVED (Dec 18, 2025) - Feature disabled

    // Start scheduling from now or next business hour
    let scheduledTime = new Date();
    const currentHour = scheduledTime.getUTCHours();

    // If outside business hours, start at next business day 8 AM
    if (currentHour < BUSINESS_START_HOUR) {
      scheduledTime.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
    } else if (currentHour >= BUSINESS_END_HOUR) {
      scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
      scheduledTime.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
    }

    // Skip to next business day if weekend/holiday
    while (isWeekend(scheduledTime) || isPublicHoliday(scheduledTime)) {
      scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
      scheduledTime.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
    }

    let dailyCount = 0;
    let insertedCount = 0;
    const insertErrors: string[] = [];

    for (let i = 0; i < newProspects.length; i++) {
      const prospect = newProspects[i];

      // Check if we've hit daily limit
      if (dailyCount >= MAX_PER_DAY) {
        // Move to next business day
        scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
        scheduledTime.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
        dailyCount = 0;

        // Skip weekends/holidays
        while (isWeekend(scheduledTime) || isPublicHoliday(scheduledTime)) {
          scheduledTime.setUTCDate(scheduledTime.getUTCDate() + 1);
          scheduledTime.setUTCHours(BUSINESS_START_HOUR, 0, 0, 0);
        }
      }

      // Add RANDOM spacing within the day (after first prospect)
      // Range: 20-45 minutes for human-like pattern
      if (dailyCount > 0) {
        const randomInterval = getRandomInterval();
        scheduledTime = new Date(scheduledTime.getTime() + (randomInterval * 60 * 1000));
      }

      // A/B TESTING REMOVED (Dec 18, 2025)

      // Personalize message - handle all variable formats and null values
      // FIX (Dec 18): Normalize company names to human-friendly format
      const firstName = prospect.first_name || prospect.firstName || '';
      const lastName = prospect.last_name || prospect.lastName || '';
      const rawCompanyName = prospect.company_name || prospect.company || '';
      const companyName = normalizeCompanyName(rawCompanyName) || rawCompanyName;
      const title = prospect.title || prospect.job_title || '';

      // SPINTAX REMOVED (Dec 18, 2025) - Feature disabled due to bugs
      // Spintax was causing issues by processing {company_name} as single-option spintax
      // Direct personalization only - no spintax processing

      // Personalize the message (replace {first_name}, {company_name}, etc.)
      const personalizedMessage = connectionMessage
        .replace(/\{first_name\}/gi, firstName)
        .replace(/\{last_name\}/gi, lastName)
        .replace(/\{company_name\}/gi, companyName)
        .replace(/\{title\}/gi, title);

      // Log if any variables weren't replaced (debugging)
      // Check for unreplaced personalization vars (not spintax)
      const unreplacedVars = personalizedMessage.match(/\{[a-z_]+\}/gi);
      if (unreplacedVars && unreplacedVars.length > 0) {
        console.warn(`⚠️ Unreplaced variables for ${firstName}: ${unreplacedVars.join(', ')}`);
      }

      // CRITICAL FIX (Dec 18): Extract slug from URL to prevent "User ID does not match format" errors
      let cleanLinkedInId = getBestLinkedInIdentifier(prospect) || extractLinkedInSlug(prospect.linkedin_url);

      // CRITICAL FIX (Dec 19): Resolve vanity to provider_id before insertion
      if (!cleanLinkedInId.startsWith('ACo') && !cleanLinkedInId.startsWith('ACw')) {
        try {
          cleanLinkedInId = await resolveToProviderId(cleanLinkedInId, linkedinAccount.unipile_account_id);
        } catch (err) {
          console.warn(`⚠️ Could not resolve provider_id for ${firstName}: ${err}`);
          // Keep the vanity - will be resolved during queue processing
        }
      }

      // Insert queue record
      try {
        await pool.query(
          `INSERT INTO send_queue (
            campaign_id, prospect_id, linkedin_user_id, message, scheduled_for, status
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            campaignId,
            prospect.id,
            cleanLinkedInId,
            personalizedMessage,
            scheduledTime.toISOString(),
            'pending'
          ]
        );
        insertedCount++;
      } catch (insertError: any) {
        insertErrors.push(`${cleanLinkedInId}: ${insertError.message}`);
        if (insertErrors.length <= 3) {
          console.warn(`⚠️ Failed to queue: ${insertError.message}`);
        }
      }

      dailyCount++;
    }

    if (insertErrors.length > 0) {
      console.error(`❌ ${insertErrors.length} queue inserts failed`);
    }

    console.log(`✅ Queued ${insertedCount}/${newProspects.length} prospects successfully (${skippedCount} already in queue)`);

    // A/B TESTING REMOVED (Dec 18, 2025)

    // Sync prospects to Airtable with "No Response" status (initial state)
    // This runs async in background - don't block the response
    syncProspectsToAirtable(newProspects, campaign.campaign_name).catch(err => {
      console.error('❌ Background Airtable sync failed:', err);
    });

    return NextResponse.json({
      success: true,
      queued: insertedCount,
      skipped: skippedCount,
      failed: insertErrors.length,
      firstScheduled: insertedCount > 0 ? scheduledTime.toISOString() : null,
      message: `${insertedCount} prospects queued for sending${skippedCount > 0 ? ` (${skippedCount} already queued)` : ''}${insertErrors.length > 0 ? ` (${insertErrors.length} failed)` : ''}`
    });

  } catch (error: any) {
    if ((error as AuthError).statusCode) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('❌ Queue creation error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * Sync prospects to Airtable with "No Response" status
 * Runs in background to not block the queue creation response
 */
async function syncProspectsToAirtable(prospects: any[], campaignName: string) {
  console.log(`📊 Syncing ${prospects.length} prospects to Airtable (No Response)...`);

  let successCount = 0;
  let errorCount = 0;

  for (const prospect of prospects) {
    try {
      const result = await airtableService.syncLinkedInLead({
        profileUrl: prospect.linkedin_url,
        name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || 'Unknown',
        jobTitle: prospect.title,
        companyName: prospect.company_name || prospect.company,
        linkedInAccount: campaignName,
        intent: 'no_response', // Initial status - they haven't responded yet
      });

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.log(`⚠️ Airtable sync failed for ${prospect.first_name}: ${result.error}`);
      }
    } catch (err) {
      errorCount++;
      console.error(`❌ Airtable sync error for ${prospect.first_name}:`, err);
    }
  }

  console.log(`✅ Airtable sync complete: ${successCount} synced, ${errorCount} errors`);
}
