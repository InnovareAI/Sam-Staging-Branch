import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * Debug endpoint to check campaign prospects
 * GET /api/campaigns/debug-prospects?campaign_id=xxx
 */
export async function GET(req: NextRequest) {
  try {
    // Firebase authentication
    const { userId, workspaceId } = await verifyAuth(req);

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaign_id');
    const campaignName = searchParams.get('campaign_name');

    // Allow workspace_id override from query params for flexibility
    const targetWorkspaceId = searchParams.get('workspace_id') || workspaceId;

    if (!campaignId && !campaignName) {
      return NextResponse.json({
        error: 'campaign_id or campaign_name required'
      }, { status: 400 });
    }

    let campaign;

    // Find campaign by name or ID, filtered by workspace
    if (campaignName) {
      const result = await pool.query(
        `SELECT * FROM campaigns
         WHERE workspace_id = $1
           AND name ILIKE $2
         LIMIT 1`,
        [targetWorkspaceId, `%${campaignName}%`]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          error: 'Campaign not found',
          workspace_id: targetWorkspaceId,
          searched_name: campaignName
        }, { status: 404 });
      }
      campaign = result.rows[0];
    } else {
      const result = await pool.query(
        `SELECT * FROM campaigns
         WHERE workspace_id = $1
           AND id = $2`,
        [targetWorkspaceId, campaignId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({
          error: 'Campaign not found',
          workspace_id: targetWorkspaceId,
          searched_id: campaignId
        }, { status: 404 });
      }
      campaign = result.rows[0];
    }

    // Get prospect count
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM campaign_prospects WHERE campaign_id = $1`,
      [campaign.id]
    );
    const prospectCount = parseInt(countResult.rows[0].count);

    // Get actual prospects
    const prospectsResult = await pool.query(
      `SELECT id, first_name, last_name, linkedin_url, status, created_at
       FROM campaign_prospects
       WHERE campaign_id = $1
       LIMIT 10`,
      [campaign.id]
    );

    // Get LinkedIn sent count
    const linkedinSentResult = await pool.query(
      `SELECT COUNT(*) as count FROM campaign_prospects
       WHERE campaign_id = $1
         AND status IN ('connection_requested', 'queued_in_n8n', 'contacted')`,
      [campaign.id]
    );
    const linkedinSent = parseInt(linkedinSentResult.rows[0].count);

    // Get message stats
    const messagesResult = await pool.query(
      `SELECT id, status FROM campaign_messages WHERE campaign_id = $1`,
      [campaign.id]
    );

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
        email_messages: messagesResult.rows?.length || 0,
        total_sent: (linkedinSent || 0) + (messagesResult.rows?.length || 0)
      },
      sample_prospects: prospectsResult.rows || []
    });

  } catch (error: any) {
    // Handle AuthError
    if (error && typeof error === 'object' && 'code' in error && 'statusCode' in error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
