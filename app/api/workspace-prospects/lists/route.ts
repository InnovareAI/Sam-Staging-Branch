import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * GET /api/workspace-prospects/lists
 * Returns approved prospect lists (sessions) with prospect counts
 */
export async function GET(req: NextRequest) {
    try {
        // Firebase auth - workspace comes from header
        let authContext;
        try {
            authContext = await verifyAuth(req);
        } catch (error) {
            const authError = error as AuthError;
            return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
        }

        const { workspaceId } = authContext;

        // Get approval sessions with prospect counts
        const { rows: sessions } = await pool.query(
            `SELECT id, campaign_name, campaign_tag, status, created_at, approved_count, total_prospects
             FROM prospect_approval_sessions
             WHERE workspace_id = $1
             ORDER BY created_at DESC`,
            [workspaceId]
        );

        // For each session, get available (not yet in campaign) prospect count
        const listsWithAvailable = await Promise.all(
            (sessions || []).map(async (session: any) => {
                // Get approved prospects for this session
                const { rows: approvedProspects } = await pool.query(
                    `SELECT id, contact FROM prospect_approval_data
                     WHERE session_id = $1 AND approval_status = 'approved'`,
                    [session.id]
                );

                const linkedinUrls = (approvedProspects || [])
                    .map((p: any) => p.contact?.linkedin_url || p.contact?.linkedin_profile_url)
                    .filter(Boolean);

                // Check which are already in campaigns
                let availableCount = linkedinUrls.length;
                if (linkedinUrls.length > 0) {
                    const { rows: campaignProspects } = await pool.query(
                        `SELECT linkedin_url FROM campaign_prospects
                         WHERE workspace_id = $1 AND linkedin_url = ANY($2)`,
                        [workspaceId, linkedinUrls]
                    );

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
