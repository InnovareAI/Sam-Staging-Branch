import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

// Cache bust: 2025-10-10-v9 - Migrated to Firebase/PG
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate (handles Bearer token and Cookies)
    const { userId, userEmail } = await verifyAuth(request);

    console.log('[workspace/list] Authenticated user:', userId, userEmail);

    // 2. Get user's current_workspace_id from users table
    const userResult = await pool.query(
      'SELECT current_workspace_id FROM users WHERE id = $1',
      [userId]
    );
    const userRecord = userResult.rows[0];

    console.log('[workspace/list] User current_workspace_id:', userRecord?.current_workspace_id);

    // 3. Check if user is super admin
    const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];
    const isSuperAdmin = userEmail ? SUPER_ADMIN_EMAILS.includes(userEmail) : false;

    console.log('[workspace/list] Is super admin:', isSuperAdmin, userEmail);

    let workspaceIds: string[] = [];

    if (isSuperAdmin) {
      // Super admins see ALL workspaces
      console.log('[workspace/list] Super admin - fetching ALL workspaces');
      const allWorkspacesResult = await pool.query('SELECT id FROM workspaces');
      workspaceIds = allWorkspacesResult.rows.map(w => w.id);
      console.log('[workspace/list] Super admin - found', workspaceIds.length, 'workspaces');
    } else {
      // Regular users - only see their memberships
      const membershipsResult = await pool.query(
        "SELECT workspace_id FROM workspace_members WHERE user_id = $1 AND status = 'active'",
        [userId]
      );
      workspaceIds = membershipsResult.rows.map(m => m.workspace_id);
    }

    console.log('[workspace/list] Workspace IDs to fetch:', workspaceIds.length);

    if (workspaceIds.length === 0) {
      console.log('[workspace/list] No workspaces found for user:', userId);
      return NextResponse.json({
        workspaces: [],
        current: null,
        debug: {
          userId,
          userEmail,
          isSuperAdmin,
          reason: 'no_workspace_memberships'
        }
      });
    }

    // 4. Parallel Fetch: Workspaces, Members, Invitations
    // We construct the ANY($1) parameter for the IN clause
    const [workspacesResult, membersResult, invitationsResult] = await Promise.all([
      // Query 1: Workspaces
      pool.query(
        `SELECT id, name, created_at, owner_id, commenting_agent_enabled 
         FROM workspaces 
         WHERE id = ANY($1::uuid[]) 
         ORDER BY created_at DESC`,
        [workspaceIds]
      ),
      // Query 2: Members (for all fetched workspaces)
      pool.query(
        `SELECT id, user_id, role, workspace_id, linkedin_unipile_account_id 
         FROM workspace_members 
         WHERE workspace_id = ANY($1::uuid[])`,
        [workspaceIds]
      ),
      // Query 3: Pending invitations
      pool.query(
        `SELECT workspace_id, invited_email, status 
         FROM workspace_invitations 
         WHERE workspace_id = ANY($1::uuid[]) AND status = 'pending'`,
        [workspaceIds]
      )
    ]);

    const workspaceData = workspacesResult.rows;
    const allMembers = membersResult.rows;
    const allInvitations = invitationsResult.rows;

    // 5. Stitch data together
    const workspaces = workspaceData.map(ws => {
      const wsMembers = allMembers.filter(m => m.workspace_id === ws.id);
      const wsInvitations = allInvitations.filter(i => i.workspace_id === ws.id);

      return {
        ...ws,
        workspace_members: wsMembers,
        pending_invitations_count: wsInvitations.length,
        pending_invitations: wsInvitations.map(i => ({
          email: i.invited_email,
          status: i.status
        }))
      };
    });

    // 6. Determine current workspace
    let current = null;
    if (userRecord?.current_workspace_id) {
      current = workspaces.find(ws => ws.id === userRecord.current_workspace_id) || null;
      console.log('[workspace/list] Found current workspace from DB:', current?.name || 'not found in list');
    }

    // Fallback if current not set or not accessible
    if (!current && workspaces.length > 0) {
      current = workspaces[0];
      console.log('[workspace/list] Using first workspace as fallback:', current.name);
    }

    console.log('[workspace/list] Returning:', { workspaceCount: workspaces.length, current: current?.name });

    return NextResponse.json({
      workspaces,
      current,
      debug: {
        userId,
        userEmail,
        isSuperAdmin,
        workspaceCount: workspaces.length,
        workspaceIds
      }
    });

  } catch (error: any) {
    console.error('[workspace/list] Exception:', error);
    // Return 401 if auth failed, otherwise 500
    const status = error.message?.includes('Authentication') ? 401 : 500;
    return NextResponse.json({
      workspaces: [],
      error: error.message || 'Internal Server Error'
    }, { status });
  }
}
