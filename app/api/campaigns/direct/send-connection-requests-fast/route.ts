import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { createClient } from '@supabase/supabase-js';
import { airtableService } from '@/lib/airtable';
import { spinForProspect, personalizeMessage, validateSpintax } from '@/lib/anti-detection/spintax';
import { getMessageVarianceContext, getABTestVariant } from '@/lib/anti-detection/message-variance';

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

// Service role client for queue operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    let user = null;

    if (!isInternalCall) {
      // User-initiated request: require authentication
      const supabase = await createSupabaseRouteClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        console.error('❌ Authentication failed:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = authUser;
    } else {
      console.log(`🤖 Internal trigger (${internalTrigger}) - bypassing user auth`);
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    console.log(`🚀 FAST queue creation for campaign: ${campaignId} (${isInternalCall ? internalTrigger : `user: ${user?.email}`})`);

    // 1. Fetch campaign - use admin client for cron, or user client for RLS check
    // CRITICAL FIX (Dec 4): Also fetch connection_message column AND linkedin_config
    // CRITICAL FIX (Dec 10): Also fetch linkedin_account_id to validate it exists
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select(`
        id,
        campaign_name,
        name,
        message_templates,
        workspace_id,
        draft_data,
        linkedin_config,
        connection_message,
        linkedin_account_id,
        workspace_accounts!linkedin_account_id (
          id,
          unipile_account_id,
          account_name,
          connection_status
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found or access denied:', campaignError);
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
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
    const linkedinAccount = campaign.workspace_accounts as any;
    if (!linkedinAccount) {
      console.error('❌ CRITICAL: LinkedIn account not found in workspace_accounts!');
      return NextResponse.json({
        error: 'LinkedIn account not found',
        details: 'The configured LinkedIn account no longer exists. Please select a different account.',
        campaignId
      }, { status: 400 });
    }

    if (linkedinAccount.connection_status !== 'connected') {
      console.error(`❌ LinkedIn account is ${linkedinAccount.connection_status}, not connected`);
      return NextResponse.json({
        error: 'LinkedIn account disconnected',
        details: `The account "${linkedinAccount.account_name}" is ${linkedinAccount.connection_status}. Please reconnect it in Settings → LinkedIn Accounts.`,
        campaignId
      }, { status: 400 });
    }

    console.log(`✅ LinkedIn account validated: ${linkedinAccount.account_name} (${linkedinAccount.unipile_account_id})`)

    // 1.5. CRITICAL FIX: Transfer draft_data.csvData to campaign_prospects if needed
    // This handles the case where drafts were created with prospects stored in draft_data
    // but never transferred to campaign_prospects table
    const draftData = campaign.draft_data as { csvData?: any[] } | null;
    if (draftData?.csvData && draftData.csvData.length > 0) {
      // Check if campaign_prospects is empty for this campaign
      const { count: existingCount } = await supabaseAdmin
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      if (existingCount === 0) {
        console.log(`📦 Transferring ${draftData.csvData.length} prospects from draft_data to campaign_prospects`);

        // Map draft_data.csvData to campaign_prospects format
        const prospectsToInsert = draftData.csvData.map((p: any) => ({
          campaign_id: campaignId,
          workspace_id: campaign.workspace_id,
          first_name: p.firstName || p.first_name || p.name?.split(' ')[0] || 'Unknown',
          last_name: p.lastName || p.last_name || p.name?.split(' ').slice(1).join(' ') || '',
          linkedin_url: p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url,
          provider_id: p.provider_id || p.providerId || null,
          company: p.company || p.organization || null,
          title: p.title || p.job_title || null,
          status: 'pending',
          created_at: new Date().toISOString()
        })).filter((p: any) => p.linkedin_url); // Only insert prospects with LinkedIn URLs

        if (prospectsToInsert.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('campaign_prospects')
            .insert(prospectsToInsert);

          if (insertError) {
            console.error('❌ Error transferring draft prospects:', insertError);
            // Continue anyway - don't fail the entire activation
          } else {
            console.log(`✅ Transferred ${prospectsToInsert.length} prospects to campaign_prospects`);
          }
        }
      }
    }

    // 2. Fetch prospects ready for outreach (limit 50)
    // CRITICAL FIX (Dec 8): Include BOTH 'pending' AND 'approved' statuses
    // Prospects go through approval workflow → status becomes 'approved'
    // We need to queue approved prospects, not just pending ones
    const { data: prospects, error: prospectsError } = await supabaseAdmin
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'approved'])  // Include both pending and approved
      .not('linkedin_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(50);

    if (prospectsError) {
      console.error('Error fetching prospects:', prospectsError);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      console.log('✅ No pending prospects');
      return NextResponse.json({ success: true, queued: 0, message: 'No pending prospects' });
    }

    // 2.5: Check which prospects are already in queue (to avoid duplicates)
    const prospectIds = prospects.map(p => p.id);
    const { data: existingQueue } = await supabaseAdmin
      .from('send_queue')
      .select('prospect_id')
      .eq('campaign_id', campaignId)
      .in('prospect_id', prospectIds);

    const existingProspectIds = new Set((existingQueue || []).map(q => q.prospect_id));
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

    const queueRecords = [];
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

    // A/B Testing: Check if enabled and get variant B message
    const abTestingEnabled = campaign.message_templates?.ab_testing_enabled || false;
    const connectionMessageB = campaign.message_templates?.connection_request_b || null;

    if (abTestingEnabled && connectionMessageB) {
      console.log('🧪 A/B Testing ENABLED - will alternate between variants A and B (50/50)');
    } else if (abTestingEnabled && !connectionMessageB) {
      console.log('⚠️ A/B Testing enabled but no Variant B message found - using Variant A only');
    }

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

      // A/B Testing: Use improved distribution (not just even/odd)
      // This uses multiple factors (time, day, random) for natural distribution
      const useAbTesting = abTestingEnabled && connectionMessageB;
      const abResult = useAbTesting ? getABTestVariant(i, prospect.id) : null;
      const variant: 'A' | 'B' | null = abResult?.variant || null;
      const messageToUse = variant === 'B' ? connectionMessageB : connectionMessage;

      // Personalize message - handle all variable formats and null values
      const firstName = prospect.first_name || prospect.firstName || '';
      const lastName = prospect.last_name || prospect.lastName || '';
      const companyName = prospect.company_name || prospect.company || '';
      const title = prospect.title || prospect.job_title || '';

      // STEP 1: Process SPINTAX first (deterministic per prospect)
      // Spintax syntax: {option1|option2|option3} creates variations
      // Same prospect always gets same spin (deterministic via prospect.id)
      const spintaxResult = spinForProspect(messageToUse, prospect.id);
      let processedMessage = spintaxResult.output;

      // Log spintax processing if variations were found
      if (spintaxResult.variationsCount > 1) {
        console.log(`🎲 Spintax: ${spintaxResult.variationsCount} variations, selected: "${spintaxResult.optionsSelected.slice(0, 3).join(', ')}${spintaxResult.optionsSelected.length > 3 ? '...' : ''}"`);
      }

      // STEP 2: Personalize the spun message
      // Use the centralized personalizeMessage function for consistency
      const personalizedMessage = personalizeMessage(processedMessage, {
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        title: title,
      });

      // Log if any variables weren't replaced (debugging)
      // Check for unreplaced personalization vars (not spintax)
      const unreplacedVars = personalizedMessage.match(/\{[a-z_]+\}/gi);
      if (unreplacedVars && unreplacedVars.length > 0) {
        console.warn(`⚠️ Unreplaced variables for ${firstName}: ${unreplacedVars.join(', ')}`);
      }

      queueRecords.push({
        campaign_id: campaignId,
        prospect_id: prospect.id,
        linkedin_user_id: prospect.linkedin_user_id || prospect.linkedin_url,
        message: personalizedMessage,
        scheduled_for: scheduledTime.toISOString(),
        status: 'pending',
        variant: variant // A/B testing: 'A', 'B', or null
      });

      dailyCount++;
    }

    // 4. Bulk insert (fast - single transaction)
    const { error: insertError } = await supabaseAdmin
      .from('send_queue')
      .insert(queueRecords);

    if (insertError) {
      console.error('Failed to create queue:', insertError);
      return NextResponse.json({ error: 'Failed to create queue' }, { status: 500 });
    }

    console.log(`✅ Queued ${queueRecords.length} prospects successfully (${skippedCount} already in queue)`);

    // 4.5. Update campaign_prospects with A/B variant assignments (if A/B testing enabled)
    if (abTestingEnabled && connectionMessageB) {
      const variantAProspects = queueRecords.filter(q => q.variant === 'A').map(q => q.prospect_id);
      const variantBProspects = queueRecords.filter(q => q.variant === 'B').map(q => q.prospect_id);

      // Update Variant A prospects
      if (variantAProspects.length > 0) {
        await supabaseAdmin
          .from('campaign_prospects')
          .update({ ab_variant: 'A' })
          .in('id', variantAProspects);
      }

      // Update Variant B prospects
      if (variantBProspects.length > 0) {
        await supabaseAdmin
          .from('campaign_prospects')
          .update({ ab_variant: 'B' })
          .in('id', variantBProspects);
      }

      console.log(`🧪 A/B variants assigned: ${variantAProspects.length} Variant A, ${variantBProspects.length} Variant B`);
    }

    // Sync prospects to Airtable with "No Response" status (initial state)
    // This runs async in background - don't block the response
    syncProspectsToAirtable(newProspects, campaign.campaign_name).catch(err => {
      console.error('❌ Background Airtable sync failed:', err);
    });

    return NextResponse.json({
      success: true,
      queued: queueRecords.length,
      skipped: skippedCount,
      firstScheduled: queueRecords[0]?.scheduled_for,
      lastScheduled: queueRecords[queueRecords.length - 1]?.scheduled_for,
      message: `${queueRecords.length} prospects queued for sending${skippedCount > 0 ? ` (${skippedCount} already queued)` : ''}`
    });

  } catch (error: any) {
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
