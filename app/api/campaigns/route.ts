import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace_id from URL params or user metadata
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id') || user.user_metadata.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Get campaigns for this workspace with prospect counts
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        description,
        campaign_type,
        type,
        status,
        launched_at,
        created_at,
        updated_at,
        message_templates,
        execution_preferences
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch campaigns:', error);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    // Enrich campaigns with prospect counts and metrics
    const enrichedCampaigns = await Promise.all(campaigns.map(async (campaign: any) => {
      // Get prospect count
      const { count: prospectCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      // Get message stats
      const { data: messages } = await supabase
        .from('campaign_messages')
        .select('id, status')
        .eq('campaign_id', campaign.id);

      const sent = messages?.length || 0;
      const connected = messages?.filter((m: any) => m.status === 'accepted' || m.status === 'connected').length || 0;

      // Get reply count
      const { count: replyCount } = await supabase
        .from('campaign_replies')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaign.id);

      return {
        ...campaign,
        type: campaign.campaign_type || campaign.type, // Use campaign_type as type for consistency
        prospects: prospectCount || 0,
        sent: sent,
        connections: connected,
        replies: replyCount || 0,
        response_rate: sent > 0 ? ((replyCount || 0) / sent * 100).toFixed(1) : 0
      };
    }));

    return NextResponse.json({ campaigns: enrichedCampaigns });

  } catch (error: any) {
    console.error('Campaign fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    
    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      workspace_id,
      name,
      description,
      campaign_type = 'multi_channel',
      target_icp = {},
      ab_test_variant,
      message_templates = {},
      status = 'inactive' // Default to 'inactive' so approved campaigns show in Inactive tab
    } = await req.json();

    if (!workspace_id || !name) {
      return NextResponse.json({
        error: 'Workspace ID and campaign name are required'
      }, { status: 400 });
    }

    // Create campaign using database function
    const { data: campaignId, error } = await supabase
      .rpc('create_campaign', {
        p_workspace_id: workspace_id,
        p_name: name,
        p_description: description,
        p_campaign_type: campaign_type,
        p_target_icp: target_icp,
        p_ab_test_variant: ab_test_variant,
        p_message_templates: message_templates
      });

    if (error) {
      console.error('Failed to create campaign:', error);
      return NextResponse.json({
        error: 'Failed to create campaign',
        details: error.message
      }, { status: 500 });
    }

    // Update status to the requested value (default 'inactive')
    const { error: statusError } = await supabase
      .from('campaigns')
      .update({ status })
      .eq('id', campaignId);

    if (statusError) {
      console.error('Failed to update campaign status:', statusError);
    }

    // Get the created campaign with details
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch created campaign:', fetchError);
      return NextResponse.json({ 
        error: 'Campaign created but failed to fetch details',
        campaign_id: campaignId 
      }, { status: 201 });
    }

    return NextResponse.json({ 
      message: 'Campaign created successfully',
      campaign 
    }, { status: 201 });

  } catch (error: any) {
    console.error('Campaign creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create campaign', details: error.message },
      { status: 500 }
    );
  }
}