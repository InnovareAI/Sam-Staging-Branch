import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * GET /api/prospect-approval/approved?workspace_id=xxx
 * Get all approved prospects ready for campaign creation
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId: authWorkspaceId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id') || authWorkspaceId;
    const sessionId = searchParams.get('session_id'); // REQUIRED: must specify which session to load from

    if (!workspaceId) {
      return NextResponse.json({
        success: false,
        error: 'workspace_id required'
      }, { status: 400 });
    }

    // Dec 8 FIX: Require session_id to prevent loading prospects from wrong sessions
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'session_id required - must specify which approval session to load prospects from'
      }, { status: 400 });
    }

    // Verify workspace access
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Not a member of this workspace'
      }, { status: 403 });
    }

    // Verify session belongs to this workspace
    const sessionResult = await pool.query(
      'SELECT id FROM prospect_approval_sessions WHERE id = $1 AND workspace_id = $2',
      [sessionId, workspaceId]
    );

    if (sessionResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        prospects: [],
        total: 0,
        message: 'Session not found or does not belong to this workspace'
      });
    }

    // Get approved prospects from the specific session with session data
    const approvedDataResult = await pool.query(
      `SELECT
         pad.*,
         pas.workspace_id as session_workspace_id,
         pas.campaign_id,
         pas.campaign_name,
         pas.campaign_tag,
         pas.prospect_source,
         c.campaign_type
       FROM prospect_approval_data pad
       JOIN prospect_approval_sessions pas ON pad.session_id = pas.id
       LEFT JOIN campaigns c ON pas.campaign_id = c.id
       WHERE pad.session_id = $1 AND pad.approval_status = 'approved'
       ORDER BY pad.created_at DESC`,
      [sessionId]
    );

    const approvedData = approvedDataResult.rows;

    // Filter out prospects that are already in campaigns
    const prospectsWithCampaignStatus = await Promise.all(
      (approvedData || []).map(async (prospect) => {
        // CRITICAL FIX: Extract LinkedIn URL from contact JSONB object
        const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || null;

        // Check if this prospect is already in ANY campaign
        let campaignProspect = null;
        if (linkedinUrl) {
          const campaignProspectResult = await pool.query(
            `SELECT cp.campaign_id, c.name as campaign_name, c.status
             FROM campaign_prospects cp
             JOIN campaigns c ON cp.campaign_id = c.id
             WHERE cp.linkedin_url = $1
             LIMIT 1`,
            [linkedinUrl]
          );
          campaignProspect = campaignProspectResult.rows[0] || null;
        }

        return {
          ...prospect,
          // CRITICAL FIX: Flatten linkedin_url to top level for campaign creation
          linkedin_url: linkedinUrl,
          // CRITICAL FIX (Dec 7): Flatten campaign_name from session to top level for CampaignHub
          campaignName: prospect.campaign_name || 'Approved Prospects',
          campaignTag: prospect.campaign_tag || 'approved',
          sessionId: prospect.session_id,
          in_campaign: !!campaignProspect,
          campaign_id: campaignProspect?.campaign_id,
          campaign_name: campaignProspect?.campaign_name
        };
      })
    );

    // Only return prospects NOT in campaigns AND with valid LinkedIn URLs
    const availableProspects = prospectsWithCampaignStatus.filter(p =>
      !p.in_campaign && p.linkedin_url && p.linkedin_url.trim() !== ''
    );

    return NextResponse.json({
      success: true,
      prospects: availableProspects,
      total: availableProspects.length
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Approved prospects fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
