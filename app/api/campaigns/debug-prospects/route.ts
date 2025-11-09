import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * Debug endpoint to check campaign prospects
 * GET /api/campaigns/debug-prospects?campaign_id=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaign_id');
    const campaignName = searchParams.get('campaign_name');

    // Get workspace_id from URL params or user metadata
    const workspaceId = searchParams.get('workspace_id') || user.user_metadata.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    if (!campaignId && !campaignName) {
      return NextResponse.json({
        error: 'campaign_id or campaign_name required'
      }, { status: 400 });
    }

    let campaign;

    // Find campaign by name or ID, filtered by workspace
    if (campaignName) {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .ilike('name', `%${campaignName}%`)
        .limit(1)
        .single();

      if (error) {
        return NextResponse.json({
          error: 'Campaign not found',
          details: error.message,
          workspace_id: workspaceId,
          searched_name: campaignName
        }, { status: 404 });
      }
      campaign = data;
    } else {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('id', campaignId)
        .single();

      if (error) {
        return NextResponse.json({
          error: 'Campaign not found',
          details: error.message,
          workspace_id: workspaceId,
          searched_id: campaignId
        }, { status: 404 });
      }
      campaign = data;
    }

    // Get prospect count
    const { count: prospectCount, error: countError } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);

    // Get actual prospects
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, status, created_at')
      .eq('campaign_id', campaign.id)
      .limit(10);

    // Get LinkedIn sent count
    const { count: linkedinSent } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .in('status', ['connection_requested', 'queued_in_n8n', 'contacted']);

    // Get message stats
    const { data: messages } = await supabase
      .from('campaign_messages')
      .select('id, status')
      .eq('campaign_id', campaign.id);

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        created_at: campaign.created_at,
        workspace_id: campaign.workspace_id
      },
      stats: {
        total_prospects: prospectCount || 0,
        linkedin_sent: linkedinSent || 0,
        email_messages: messages?.length || 0,
        total_sent: (linkedinSent || 0) + (messages?.length || 0)
      },
      sample_prospects: prospects || [],
      errors: {
        count_error: countError?.message || null,
        prospects_error: prospectsError?.message || null
      }
    });

  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
