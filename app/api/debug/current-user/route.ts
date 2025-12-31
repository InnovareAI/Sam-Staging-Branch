import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

/**
 * GET /api/debug/current-user
 * Returns current user info and workspace info for debugging
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await verifyAuth(request);
    const { userId, userEmail } = authContext;

    // Get user profile
    const userResult = await pool.query(
      'SELECT current_workspace_id FROM users WHERE id = $1',
      [userId]
    );
    const userProfile = userResult.rows[0];

    // Get workspace memberships
    const membershipsResult = await pool.query(
      'SELECT workspace_id, role FROM workspace_members WHERE user_id = $1',
      [userId]
    );

    // Get workspace details if current_workspace_id exists
    let workspaceDetails = null;
    if (userProfile?.current_workspace_id) {
      const workspaceResult = await pool.query(
        'SELECT id, name, slug FROM workspaces WHERE id = $1',
        [userProfile.current_workspace_id]
      );
      if (workspaceResult.rows.length > 0) {
        workspaceDetails = workspaceResult.rows[0];
      }
    }

    // Get sessions for this user
    const sessionsResult = await pool.query(
      `SELECT id, campaign_name, total_prospects, pending_count, approved_count, workspace_id, created_at 
       FROM prospect_approval_sessions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: userEmail,
        current_workspace_id: userProfile?.current_workspace_id
      },
      workspace: workspaceDetails,
      memberships: membershipsResult.rows || [],
      sessions: sessionsResult.rows || [],
      sessionCount: sessionsResult.rows.length || 0
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
