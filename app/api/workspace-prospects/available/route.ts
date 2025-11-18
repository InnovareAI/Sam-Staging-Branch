import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * GET /api/workspace-prospects/available
 * Returns approved prospects that are NOT yet assigned to any campaign
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace_id from query params
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get prospects from workspace_prospects that are NOT in campaign_prospects
    // We check by linkedin_profile_url since campaign_prospects doesn't have a foreign key to workspace_prospects
    const { data: prospects, error } = await supabase
      .from('workspace_prospects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching workspace prospects:', error);
      return NextResponse.json({ error: 'Failed to fetch prospects' }, { status: 500 });
    }

    // Filter out prospects that are already in campaigns
    // Check campaign_prospects by linkedin_url
    const linkedinUrls = (prospects || []).map(p => p.linkedin_profile_url).filter(Boolean);

    let prospectsInCampaigns: string[] = [];
    if (linkedinUrls.length > 0) {
      const { data: campaignProspects } = await supabase
        .from('campaign_prospects')
        .select('linkedin_url')
        .eq('workspace_id', workspaceId)
        .in('linkedin_url', linkedinUrls);

      prospectsInCampaigns = (campaignProspects || []).map(cp => cp.linkedin_url);
    }

    // Filter to only prospects NOT in campaigns
    const availableProspects = (prospects || []).filter(
      p => !prospectsInCampaigns.includes(p.linkedin_profile_url)
    );

    return NextResponse.json({
      prospects: availableProspects,
      total: availableProspects.length
    });

  } catch (error: any) {
    console.error('Error in /api/workspace-prospects/available:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
