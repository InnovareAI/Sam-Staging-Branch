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

  console.log('🔍 Checking for unqueued pending prospects...');

  try {
    // 1. Get all active connector campaigns (connection request campaigns)
    const { data: activeCampaigns, error: campError } = await supabase
      .from('campaigns')
      .select('id, campaign_name, linkedin_account_id, message_templates')
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
      // 2. Get pending prospects for this campaign
      const { data: pendingProspects, error: prospError } = await supabase
        .from('campaign_prospects')
        .select('id, first_name, last_name, linkedin_url, linkedin_user_id')
        .eq('campaign_id', campaign.id)
        .eq('status', 'pending')
        .not('linkedin_url', 'is', null);

      if (prospError || !pendingProspects || pendingProspects.length === 0) {
        continue;
      }

      // 3. Check which are already in queue
      const prospectIds = pendingProspects.map(p => p.id);
      const { data: existingQueue } = await supabase
        .from('send_queue')
        .select('prospect_id')
        .eq('campaign_id', campaign.id)
        .in('prospect_id', prospectIds);

      const existingIds = new Set((existingQueue || []).map(q => q.prospect_id));
      const unqueuedProspects = pendingProspects.filter(p => !existingIds.has(p.id));

      if (unqueuedProspects.length === 0) {
        continue;
      }

      console.log(`⚠️ Campaign "${campaign.campaign_name}": ${unqueuedProspects.length} unqueued prospects`);

      // 4. Queue them with 2-minute spacing
      const connectionMessage = campaign.message_templates?.connection_request ||
        'Hi {first_name}, I\'d like to connect!';

      const SPACING_MINUTES = 2;
      const queueRecords = [];
      const now = new Date();

      for (let i = 0; i < unqueuedProspects.length; i++) {
        const prospect = unqueuedProspects[i];
        const scheduledTime = new Date(now.getTime() + (i * SPACING_MINUTES * 60 * 1000));

        const personalizedMessage = connectionMessage
          .replace(/\{first_name\}/g, prospect.first_name || '')
          .replace(/\{last_name\}/g, prospect.last_name || '')
          .replace(/\{\{firstName\}\}/g, prospect.first_name || '');

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
