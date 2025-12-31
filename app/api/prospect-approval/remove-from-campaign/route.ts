import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

/**
 * DELETE /api/prospect-approval/remove-from-campaign
 *
 * Remove a prospect from an existing campaign
 * Used when user wants to move a duplicate prospect to a new campaign
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId, workspaceId } = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaign_id');
    const identifier = searchParams.get('identifier'); // linkedin_url OR email
    const identifierType = searchParams.get('type'); // 'linkedin' OR 'email'

    if (!campaignId || !identifier || !identifierType) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: campaign_id, identifier, type'
      }, { status: 400 });
    }

    // Verify user has access to this campaign's workspace
    const campaignResult = await pool.query(
      'SELECT workspace_id FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Campaign not found'
      }, { status: 404 });
    }

    const campaignWorkspaceId = campaignResult.rows[0].workspace_id;

    const memberResult = await pool.query(
      `SELECT id, role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
      [campaignWorkspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'You do not have access to this workspace'
      }, { status: 403 });
    }

    // Remove prospect from campaign_prospects table
    let deleteQuery = 'DELETE FROM campaign_prospects WHERE campaign_id = $1';
    const params: any[] = [campaignId];

    if (identifierType === 'linkedin') {
      deleteQuery += ' AND linkedin_url = $2';
      params.push(identifier);
    } else if (identifierType === 'email') {
      deleteQuery += ' AND email = $2';
      params.push(identifier);
    }

    const deleteResult = await pool.query(deleteQuery + ' RETURNING id', params);

    console.log(`✅ Removed prospect (${identifierType}: ${identifier}) from campaign ${campaignId}`);

    return NextResponse.json({
      success: true,
      message: 'Prospect removed from campaign successfully',
      removed_count: deleteResult.rowCount || 0
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
    console.error('Remove from campaign error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
