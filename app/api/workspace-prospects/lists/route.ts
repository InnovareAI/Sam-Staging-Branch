import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * GET /api/workspace-prospects/lists
 * Returns approved prospect lists (sessions) with prospect counts
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

        // Get approval sessions with prospect counts
        const { data: sessions, error: sessionError } = await supabase
            .from('prospect_approval_sessions')
            .select(`
        id,
        campaign_name,
        campaign_tag,
        status,
        created_at,
        approved_count,
        total_prospects
      `)
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false });

        if (sessionError) {
            console.error('Error fetching approval sessions:', sessionError);
            return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
        }

        // For each session, get available (not yet in campaign) prospect count
        const listsWithAvailable = await Promise.all(
            (sessions || []).map(async (session) => {
                // Get approved prospects for this session
                const { data: approvedProspects } = await supabase
                    .from('prospect_approval_data')
                    .select('id, contact')
                    .eq('session_id', session.id)
                    .eq('approval_status', 'approved');

                const linkedinUrls = (approvedProspects || [])
                    .map(p => p.contact?.linkedin_url || p.contact?.linkedin_profile_url)
                    .filter(Boolean);

                // Check which are already in campaigns
                let availableCount = linkedinUrls.length;
                if (linkedinUrls.length > 0) {
                    const { data: campaignProspects } = await supabase
                        .from('campaign_prospects')
                        .select('linkedin_url')
                        .eq('workspace_id', workspaceId)
                        .in('linkedin_url', linkedinUrls);

                    const inCampaignCount = (campaignProspects || []).length;
                    availableCount = linkedinUrls.length - inCampaignCount;
                }

                return {
                    id: session.id,
                    name: session.campaign_name || session.campaign_tag || 'Unnamed List',
                    tag: session.campaign_tag,
                    status: session.status,
                    created_at: session.created_at,
                    total_approved: session.approved_count || (approvedProspects || []).length,
                    available_count: availableCount,
                    total_prospects: session.total_prospects || 0
                };
            })
        );

        // Filter to only lists with available prospects
        const availableLists = listsWithAvailable.filter(l => l.available_count > 0);

        return NextResponse.json({
            lists: availableLists,
            total: availableLists.length,
            total_available_prospects: availableLists.reduce((sum, l) => sum + l.available_count, 0)
        });

    } catch (error: any) {
        console.error('Error in /api/workspace-prospects/lists:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
