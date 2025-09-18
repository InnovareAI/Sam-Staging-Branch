import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient();
    
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

    // Get campaigns with performance metrics
    const { data: campaigns, error } = await supabase
      .from('campaign_performance_summary')
      .select('*')
      .eq('campaign_id', workspaceId)
      .order('launched_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch campaigns:', error);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    return NextResponse.json({ campaigns });

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
    const supabase = createClient();
    
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
      message_templates = {}
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