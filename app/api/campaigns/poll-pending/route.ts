import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * N8N Polling Endpoint - Returns pending prospects that need CRs sent
 * Called by N8N Schedule Trigger every 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify internal trigger
    const trigger = request.headers.get('x-internal-trigger');
    if (trigger !== 'n8n-polling') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createSupabaseRouteClient();

    // Get pending prospects (limit to 10 per poll to avoid overwhelming)
    const { data: prospects, error } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        campaign_id,
        first_name,
        last_name,
        linkedin_url,
        status,
        company_name,
        title,
        job_title,
        campaigns (
          id,
          name,
          workspace_id,
          connection_message,
          message_templates
        )
      `)
      .in('status', ['pending', 'approved', 'ready_to_message'])
      .not('linkedin_url', 'is', null)
      .is('contacted_at', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching pending prospects:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({
        prospects: [],
        count: 0,
        message: 'No pending prospects'
      });
    }

    // Group prospects by campaign to batch process
    const campaignMap = new Map();

    for (const prospect of prospects) {
      const campaign = prospect.campaigns;
      if (!campaign) continue;

      const campaignId = campaign.id;

      if (!campaignMap.has(campaignId)) {
        // Get LinkedIn account for this campaign's workspace
        const { data: account } = await supabase
          .from('workspace_accounts')
          .select('unipile_account_id')
          .eq('workspace_id', campaign.workspace_id)
          .eq('provider', 'linkedin')
          .eq('is_active', true)
          .single();

        if (!account) {
          console.error(`❌ No active LinkedIn account for workspace ${campaign.workspace_id}`);
          continue;
        }

        campaignMap.set(campaignId, {
          campaign_id: campaignId,
          campaign_name: campaign.name,
          workspace_id: campaign.workspace_id,
          unipile_dsn: process.env.UNIPILE_DSN || '',
          unipile_api_key: process.env.UNIPILE_API_KEY || '',
          unipile_account_id: account.unipile_account_id,
          prospects: []
        });
      }

      // Personalize message (same logic as execute-live)
      const crMessage = campaign.connection_message || campaign.message_templates?.connection_request || '';
      const personalizedMessage = crMessage
        .replace(/\{first_name\}/gi, prospect.first_name || '')
        .replace(/\{last_name\}/gi, prospect.last_name || '')
        .replace(/\{company\}/gi, prospect.company_name || '')
        .replace(/\{title\}/gi, prospect.title || prospect.job_title || '');

      campaignMap.get(campaignId).prospects.push({
        id: prospect.id,
        first_name: prospect.first_name,
        last_name: prospect.last_name,
        linkedin_url: prospect.linkedin_url,
        campaign_id: campaignId,
        personalized_message: personalizedMessage
      });
    }

    // Return first campaign with prospects (N8N will process one campaign per poll)
    const firstCampaign = Array.from(campaignMap.values())[0];

    if (!firstCampaign) {
      return NextResponse.json({
        prospects: [],
        count: 0,
        message: 'No valid campaigns with active LinkedIn accounts'
      });
    }

    console.log(`✅ Returning ${firstCampaign.prospects.length} prospects from campaign: ${firstCampaign.campaign_name}`);

    return NextResponse.json({
      ...firstCampaign,
      count: firstCampaign.prospects.length
    });

  } catch (error: any) {
    console.error('❌ Error in poll-pending:', error);
    return NextResponse.json({
      error: error.message,
      prospects: [],
      count: 0
    }, { status: 500 });
  }
}
