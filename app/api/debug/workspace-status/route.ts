import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

/**
 * GET /api/debug/workspace-status
 * Checks authentication and returns workspace memberships
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authContext = await verifyAuth(request);
    const { userId, userEmail } = authContext;

    // Get user's workspaces
    const membersResult = await pool.query(
      `SELECT workspace_id, role, status 
       FROM workspace_members 
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const members = membersResult.rows;

    // Get workspace details
    let workspaces: any[] = [];
    if (members.length > 0) {
      const workspaceIds = members.map(m => m.workspace_id);

      // pg doesn't support array parameters directly in IN clause like Supabase
      // We need to construct the query dynamically or use ANY($1)
      const workspacesResult = await pool.query(
        `SELECT id, name, client_code 
         FROM workspaces 
         WHERE id = ANY($1::uuid[])`,
        [workspaceIds]
      );
      workspaces = workspacesResult.rows;
    }

    // Get user's current workspace
    const userResult = await pool.query(
      'SELECT current_workspace_id FROM users WHERE id = $1',
      [userId]
    );
    const apiUser = userResult.rows[0];

    return NextResponse.json({
      authenticated: true,
      userId: userId,
      email: userEmail,
      workspaceMemberships: members.length,
      workspaces: workspaces,
      currentWorkspaceId: apiUser?.current_workspace_id || null,
      memberships: members.map(m => ({
        workspaceId: m.workspace_id,
        role: m.role,
        status: m.status,
        workspaceName: workspaces.find(w => w.id === m.workspace_id)?.name || 'Unknown'
      }))
    });

  } catch (error: any) {
    return NextResponse.json({
      authenticated: false,
      error: error.message || 'Not authenticated',
      details: error.code || 'Unknown error'
    }, { status: 401 }); // Default to 401 if it fails
  }
}
