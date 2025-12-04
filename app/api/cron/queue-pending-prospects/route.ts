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

  console.log('🔍 [v2] Checking for unqueued pending prospects...');

  try {
    // 1. Get all active connector campaigns (connection request campaigns)
    // CRITICAL FIX (Dec 4): Also fetch connection_message and linkedin_config for message source
    const { data: activeCampaigns, error: campError } = await supabase
      .from('campaigns')
      .select('id, campaign_name, linkedin_account_id, message_templates, connection_message, linkedin_config')
      .eq('status', 'active')
      .eq('campaign_type', 'connector');

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

      // 2. Get pending prospects for this campaign
      // CRITICAL FIX (Dec 4): Include company, title for full personalization
      // FIX (Dec 4): campaign_prospects has company_name, NOT company
      const { data: pendingProspects, error: prospError } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_url, linkedin_user_id, company_name, title')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
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

      // 3. Check which are already in queue
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

      console.log(`  📬 Existing queue entries: ${existingQueue?.length || 0}`);

      const existingIds = new Set((existingQueue || []).map(q => q.prospect_id));
      const unqueuedProspects = pendingProspects.filter(p => !existingIds.has(p.id));

      console.log(`  🆕 Unqueued prospects: ${unqueuedProspects.length}`);

      if (unqueuedProspects.length === 0) {
        console.log(`  ⏭️ All ${pendingProspects.length} prospects already in queue`);
        continue;
      }

      console.log(`⚠️ Campaign "${campaign.campaign_name}": ${unqueuedProspects.length} unqueued prospects`);

      // 4. Queue them with 2-minute spacing
      // CRITICAL FIX (Dec 4): Check multiple sources for connection message
      const linkedinConfig = campaign.linkedin_config as { connection_message?: string } | null;
      const connectionMessage =
        campaign.message_templates?.connection_request ||
        campaign.connection_message ||
        linkedinConfig?.connection_message ||
        null;

      if (!connectionMessage) {
        console.error(`⚠️ Campaign "${campaign.campaign_name}" has NO connection message - skipping`);
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
          console.log(`  📝 Original template: "${connectionMessage.substring(0, 80)}..."`);
        }

        // CRITICAL: Process double-brace {{var}} BEFORE single-brace {var}
        // Otherwise {firstName} matches inside {{firstName}} leaving {value}
        const personalizedMessage = connectionMessage
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
          message_type: 'connection_request'
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
