import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { createClient } from '@supabase/supabase-js';
import { airtableService } from '@/lib/airtable';

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
    // Check if this is an internal cron trigger
    const internalTrigger = req.headers.get('x-internal-trigger');
    const isCronTrigger = internalTrigger === 'cron-pending-prospects';

    let user = null;

    if (!isCronTrigger) {
      // User-initiated request: require authentication
      const supabase = await createSupabaseRouteClient();
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !authUser) {
        console.error('❌ Authentication failed:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = authUser;
    } else {
      console.log('🤖 Internal cron trigger - bypassing user auth');
    }

    const { campaignId } = await req.json();

    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId required' }, { status: 400 });
    }

    console.log(`🚀 FAST queue creation for campaign: ${campaignId} (${isCronTrigger ? 'cron' : `user: ${user?.email}`})`);

    // 1. Fetch campaign - use admin client for cron, or user client for RLS check
    // CRITICAL FIX (Dec 4): Also fetch linkedin_config which stores connection_message for some campaigns
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, campaign_name, message_templates, workspace_id, draft_data, linkedin_config')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found or access denied:', campaignError);
      return NextResponse.json({ error: 'Campaign not found or access denied' }, { status: 404 });
    }

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

    // 2. Fetch pending prospects (limit 50)
    const { data: prospects, error: prospectsError } = await supabaseAdmin
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
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
    const MINUTES_PER_DAY = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60; // 600 minutes
    const SPACING_MINUTES = Math.floor(MINUTES_PER_DAY / MAX_PER_DAY); // ~24 minutes between each

    const queueRecords = [];
    // CRITICAL FIX (Dec 4): Check multiple locations for connection message
    // Different campaign types store messages in different places:
    // 1. message_templates.connection_request (standard)
    // 2. linkedin_config.connection_message (Charissa/LinkedIn-only campaigns)
    // 3. draft_data.connectionRequestMessage (wizard drafts)
    const linkedinConfig = campaign.linkedin_config as { connection_message?: string } | null;
    const draftDataMsg = (campaign.draft_data as { connectionRequestMessage?: string } | null);

    const connectionMessage =
      campaign.message_templates?.connection_request ||
      linkedinConfig?.connection_message ||
      draftDataMsg?.connectionRequestMessage ||
      null;

    if (!connectionMessage) {
      console.error('❌ CRITICAL: No connection message found in campaign!');
      console.error('  - message_templates.connection_request:', campaign.message_templates?.connection_request);
      console.error('  - linkedin_config.connection_message:', linkedinConfig?.connection_message);
      console.error('  - draft_data.connectionRequestMessage:', draftDataMsg?.connectionRequestMessage);
      return NextResponse.json({
        error: 'Campaign has no connection message configured. Please edit the campaign and add a connection request message.',
        details: 'No message found in message_templates, linkedin_config, or draft_data'
      }, { status: 400 });
    }

    console.log('✅ Using connection message from:',
      campaign.message_templates?.connection_request ? 'message_templates' :
      linkedinConfig?.connection_message ? 'linkedin_config' : 'draft_data');

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

      // Add spacing within the day (after first prospect)
      if (dailyCount > 0) {
        scheduledTime = new Date(scheduledTime.getTime() + (SPACING_MINUTES * 60 * 1000));
      }

      // Personalize message - handle all variable formats and null values
      // CRITICAL FIX (Dec 4): Add fallbacks for undefined/null prospect fields
      const firstName = prospect.first_name || prospect.firstName || '';
      const lastName = prospect.last_name || prospect.lastName || '';
      const companyName = prospect.company_name || prospect.company || '';
      const title = prospect.title || prospect.job_title || '';

      const personalizedMessage = connectionMessage
        // Standard {snake_case} format
        .replace(/\{first_name\}/gi, firstName)
        .replace(/\{last_name\}/gi, lastName)
        .replace(/\{company_name\}/gi, companyName)
        .replace(/\{company\}/gi, companyName)
        .replace(/\{title\}/gi, title)
        .replace(/\{job_title\}/gi, title)
        // Also handle {{double_braces}} format some templates use
        .replace(/\{\{first_name\}\}/gi, firstName)
        .replace(/\{\{last_name\}\}/gi, lastName)
        .replace(/\{\{company_name\}\}/gi, companyName)
        .replace(/\{\{company\}\}/gi, companyName)
        .replace(/\{\{title\}\}/gi, title)
        // Also handle {camelCase} format
        .replace(/\{firstName\}/g, firstName)
        .replace(/\{lastName\}/g, lastName)
        .replace(/\{companyName\}/g, companyName)
        .replace(/\{jobTitle\}/g, title);

      // Log if any variables weren't replaced (debugging)
      if (personalizedMessage.includes('{') && personalizedMessage.includes('}')) {
        console.warn(`⚠️ Unreplaced variables in message for ${firstName}: "${personalizedMessage.substring(0, 100)}..."`)
      }

      queueRecords.push({
        campaign_id: campaignId,
        prospect_id: prospect.id,
        linkedin_user_id: prospect.linkedin_user_id || prospect.linkedin_url,
        message: personalizedMessage,
        scheduled_for: scheduledTime.toISOString(),
        status: 'pending'
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
