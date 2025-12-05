import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Cron job to queue pending prospects for active campaigns
 *
 * This catches campaigns that:
 * 1. Have status='active'
 * 2. Have prospects with status='pending'
 * 3. But those prospects are NOT in send_queue
 *
 * Runs every 5 minutes via Netlify scheduled functions
 * POST /api/cron/queue-pending-prospects
 */

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🔍 [v3] Checking for unqueued pending prospects (connector + messenger)...');

  try {
    // 1. Get all active campaigns (both connector and messenger types)
    // CRITICAL FIX (Dec 4): Also fetch connection_message and linkedin_config for message source
    // FIX (Dec 4): Also handle messenger campaigns, not just connector
    const { data: activeCampaigns, error: campError } = await supabase
      .from('campaigns')
      .select('id, campaign_name, linkedin_account_id, message_templates, connection_message, linkedin_config, campaign_type')
      .eq('status', 'active')
      .in('campaign_type', ['connector', 'messenger']);

    if (campError) {
      console.error('Error fetching campaigns:', campError);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    if (!activeCampaigns || activeCampaigns.length === 0) {
      console.log('✅ No active campaigns');
      return NextResponse.json({ success: true, message: 'No active campaigns', queued: 0 });
    }

    console.log(`📊 Found ${activeCampaigns.length} active campaigns`);

    let totalQueued = 0;
    const campaignsProcessed = [];

    for (const campaign of activeCampaigns) {
      console.log(`\n🔍 Checking campaign: ${campaign.id} (${campaign.campaign_name || 'unnamed'})`);

      // 2. Get prospects that need to be queued
      // CRITICAL FIX (Dec 4): Include company, title for full personalization
      // FIX (Dec 4): campaign_prospects has company_name, NOT company
      // FIX (Dec 4): For messenger campaigns, prospects are 'approved' (1st connections), not 'pending'
      const isMessengerCampaign = campaign.campaign_type === 'messenger';
      const targetStatuses = isMessengerCampaign
        ? ['approved', 'pending']  // Messenger: queue approved/pending 1st connections
        : ['pending'];             // Connector: queue pending prospects for connection requests

      const { data: pendingProspects, error: prospError } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_url, linkedin_user_id, company_name, title')
        .eq('campaign_id', campaign.id)
        .in('status', targetStatuses)
        .not('linkedin_url', 'is', null);

      if (prospError) {
        console.error(`  ❌ Error fetching prospects for ${campaign.id}:`, prospError.message);
        continue;
      }

      if (!pendingProspects || pendingProspects.length === 0) {
        console.log(`  ⏭️ No pending prospects with linkedin_url for ${campaign.id}`);
        continue;
      }

      console.log(`  📊 Found ${pendingProspects.length} pending prospects with linkedin_url`);

      // 3. Check which are already in queue FOR THIS CAMPAIGN
      const prospectIds = pendingProspects.map(p => p.id);
      const { data: existingQueue, error: queueError } = await supabase
        .from('send_queue')
        .select('prospect_id')
        .eq('campaign_id', campaign.id)
        .in('prospect_id', prospectIds);

      if (queueError) {
        console.error(`  ❌ Error checking queue for ${campaign.id}:`, queueError.message);
        continue;
      }

      console.log(`  📬 Existing queue entries (this campaign): ${existingQueue?.length || 0}`);

      const existingIds = new Set((existingQueue || []).map(q => q.prospect_id));
      let unqueuedProspects = pendingProspects.filter(p => !existingIds.has(p.id));

      // ============================================
      // CROSS-CAMPAIGN DEDUPLICATION (Dec 5, 2025)
      // Prevents: "Should delay", "Cannot resend yet", "Cannot invite attendee"
      // ============================================

      if (unqueuedProspects.length > 0) {
        // Get all linkedin_urls for unqueued prospects
        const linkedinUrls = unqueuedProspects
          .map(p => p.linkedin_url)
          .filter(Boolean) as string[];

        // Normalize URLs for comparison (remove trailing slashes, lowercase)
        const normalizeUrl = (url: string) => url?.toLowerCase().replace(/\/+$/, '').trim();

        // 3a. Check if linkedin_url was ALREADY SENT in ANY campaign's send_queue
        const { data: previouslySent, error: sentError } = await supabase
          .from('send_queue')
          .select('linkedin_user_id')
          .in('status', ['sent', 'pending', 'failed', 'skipped'])
          .in('linkedin_user_id', linkedinUrls);

        if (sentError) {
          console.error(`  ❌ Error checking cross-campaign queue:`, sentError.message);
        }

        const sentUrls = new Set(
          (previouslySent || []).map(s => normalizeUrl(s.linkedin_user_id))
        );

        // 3b. Check if linkedin_url exists in ANY campaign_prospects with contacted status
        const contactedStatuses = [
          'connection_request_sent',
          'already_invited',
          'connected',
          'messaged',
          'replied',
          'failed'  // Don't retry failed ones either
        ];

        const { data: previouslyContacted, error: contactedError } = await supabase
          .from('campaign_prospects')
          .select('linkedin_url')
          .in('status', contactedStatuses)
          .in('linkedin_url', linkedinUrls);

        if (contactedError) {
          console.error(`  ❌ Error checking contacted prospects:`, contactedError.message);
        }

        const contactedUrls = new Set(
          (previouslyContacted || []).map(c => normalizeUrl(c.linkedin_url))
        );

        // Filter out prospects already contacted
        const beforeCount = unqueuedProspects.length;
        unqueuedProspects = unqueuedProspects.filter(p => {
          const normalizedUrl = normalizeUrl(p.linkedin_url);
          const inSentQueue = sentUrls.has(normalizedUrl);
          const wasContacted = contactedUrls.has(normalizedUrl);

          if (inSentQueue || wasContacted) {
            console.log(`  🚫 Skipping ${p.first_name} ${p.last_name} - already contacted (queue: ${inSentQueue}, status: ${wasContacted})`);
            return false;
          }
          return true;
        });

        const skippedCount = beforeCount - unqueuedProspects.length;
        if (skippedCount > 0) {
          console.log(`  ⚠️ Skipped ${skippedCount} prospects already contacted in other campaigns`);
        }
      }

      console.log(`  🆕 Unqueued prospects: ${unqueuedProspects.length}`);

      if (unqueuedProspects.length === 0) {
        console.log(`  ⏭️ All ${pendingProspects.length} prospects already in queue`);
        continue;
      }

      console.log(`⚠️ Campaign "${campaign.campaign_name}": ${unqueuedProspects.length} unqueued prospects`);

      // 4. Queue them with 2-minute spacing
      // CRITICAL FIX (Dec 4): Check multiple sources for connection message
      // FIX (Dec 4): Handle messenger campaigns - use direct_message_1 instead of connection_request
      const linkedinConfig = campaign.linkedin_config as { connection_message?: string } | null;
      const isMessenger = campaign.campaign_type === 'messenger';

      let messageTemplate: string | null = null;
      let messageType: string;

      if (isMessenger) {
        // Messenger campaigns send direct messages to 1st connections
        messageTemplate = campaign.message_templates?.direct_message_1 || null;
        messageType = 'direct_message_1';
      } else {
        // Connector campaigns send connection requests
        messageTemplate =
          campaign.message_templates?.connection_request ||
          campaign.connection_message ||
          linkedinConfig?.connection_message ||
          null;
        messageType = 'connection_request';
      }

      if (!messageTemplate) {
        console.error(`⚠️ Campaign "${campaign.campaign_name}" (${campaign.campaign_type}) has NO ${isMessenger ? 'direct_message_1' : 'connection message'} - skipping`);
        continue;
      }

      const SPACING_MINUTES = 2;
      const queueRecords = [];
      const now = new Date();

      for (let i = 0; i < unqueuedProspects.length; i++) {
        const prospect = unqueuedProspects[i];
        const scheduledTime = new Date(now.getTime() + (i * SPACING_MINUTES * 60 * 1000));

        // Full personalization - all variable formats
        const firstName = prospect.first_name || '';
        const lastName = prospect.last_name || '';
        const companyName = prospect.company_name || '';
        const title = prospect.title || '';

        // Log original template for debugging
        if (i === 0) {
          console.log(`  📝 Original template (${messageType}): "${messageTemplate.substring(0, 80)}..."`);
        }

        // CRITICAL: Process double-brace {{var}} BEFORE single-brace {var}
        // Otherwise {firstName} matches inside {{firstName}} leaving {value}
        const personalizedMessage = messageTemplate
          // Double-brace patterns FIRST (most specific)
          .replace(/\{\{firstName\}\}/g, firstName)
          .replace(/\{\{lastName\}\}/g, lastName)
          .replace(/\{\{companyName\}\}/g, companyName)
          .replace(/\{\{company\}\}/gi, companyName)
          .replace(/\{\{first_name\}\}/gi, firstName)
          .replace(/\{\{last_name\}\}/gi, lastName)
          .replace(/\{\{company_name\}\}/gi, companyName)
          // Single-brace patterns AFTER (less specific)
          .replace(/\{firstName\}/g, firstName)
          .replace(/\{lastName\}/g, lastName)
          .replace(/\{companyName\}/g, companyName)
          .replace(/\{first_name\}/gi, firstName)
          .replace(/\{last_name\}/gi, lastName)
          .replace(/\{company_name\}/gi, companyName)
          .replace(/\{company\}/gi, companyName)
          .replace(/\{title\}/gi, title);

        // Log first personalized message for debugging
        if (i === 0) {
          console.log(`  ✨ Personalized (${firstName}): "${personalizedMessage.substring(0, 80)}..."`);
        }

        queueRecords.push({
          campaign_id: campaign.id,
          prospect_id: prospect.id,
          linkedin_user_id: prospect.linkedin_user_id || prospect.linkedin_url,
          message: personalizedMessage,
          scheduled_for: scheduledTime.toISOString(),
          status: 'pending',
          message_type: messageType  // 'connection_request' for connector, 'direct_message_1' for messenger
        });
      }

      // 5. Insert queue records
      const { error: insertError } = await supabase
        .from('send_queue')
        .insert(queueRecords);

      if (insertError) {
        console.error(`Error queuing for ${campaign.campaign_name}:`, insertError);
        continue;
      }

      totalQueued += queueRecords.length;
      campaignsProcessed.push({
        name: campaign.campaign_name,
        queued: queueRecords.length
      });

      console.log(`✅ Queued ${queueRecords.length} for "${campaign.campaign_name}"`);
    }

    console.log(`\n📊 Total queued: ${totalQueued} prospects across ${campaignsProcessed.length} campaigns`);

    return NextResponse.json({
      success: true,
      totalQueued,
      campaignsProcessed,
      message: totalQueued > 0
        ? `Queued ${totalQueued} prospects`
        : 'All prospects already queued'
    });

  } catch (error: any) {
    console.error('❌ Cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
