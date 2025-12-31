import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/auth'
import { requireAdmin } from '@/lib/security/route-auth';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function GET(request: NextRequest) {
  // Require admin authentication
  const { error: authError, user } = await requireAdmin(request);
  if (authError) return authError;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 });

  try {
    console.log('🔍 Admin Workspaces: Starting query...');

    // 1. Fetch Workspaces (Direct PG Query)
    // We try to fetch workspaces with member counts directly
    const workspacesResult = await pool.query(`
      SELECT 
        w.id, w.name, w.slug, w.created_at, w.updated_at, w.owner_id,
        (SELECT count(*) FROM workspace_members wm WHERE wm.workspace_id = w.id) as member_count
      FROM workspaces w
      ORDER BY w.created_at DESC
    `);

    const workspaces = workspacesResult.rows;
    console.log(`✅ Found ${workspaces.length} workspaces`);

    // 2. Fetch Owner/Member details manually to avoid complex joins and mirror previous logic
    // Collect all user IDs
    const ownerIds = workspaces.map(w => w.owner_id).filter(Boolean);

    // We also want to fetch members for these workspaces to show in UI
    // Fetch all members for all returned workspaces
    // Note: limit to avoid massive data transfer if too many workspaces
    const workspaceIds = workspaces.map(w => w.id);
    let allMembers: any[] = [];

    if (workspaceIds.length > 0) {
      const membersResult = await pool.query(`
        SELECT id, workspace_id, user_id, role 
        FROM workspace_members 
        WHERE workspace_id = ANY($1::uuid[])
      `, [workspaceIds]);
      allMembers = membersResult.rows;
    }

    const memberUserIds = allMembers.map(m => m.user_id);
    const allUserIds = [...new Set([...ownerIds, ...memberUserIds])];

    // 3. Fetch User Details (from users table directly now!)
    const userMap = new Map();
    if (allUserIds.length > 0) {
      const usersResult = await pool.query(`
        SELECT id, email, first_name, last_name, full_name, avatar_url
        FROM users 
        WHERE id = ANY($1::text[])
      `, [allUserIds]); // Assuming ID is text/uuid text

      usersResult.rows.forEach(u => {
        userMap.set(u.id, {
          id: u.id,
          email: u.email,
          first_name: u.first_name || u.full_name?.split(' ')[0],
          last_name: u.last_name || u.full_name?.split(' ').slice(1).join(' ')
        });
      });
    }

    // 4. Enrich workspaces
    const enrichedWorkspaces = workspaces.map(workspace => ({
      ...workspace,
      owner: userMap.get(workspace.owner_id),
      workspace_members: allMembers
        .filter(m => m.workspace_id === workspace.id)
        .map(member => ({
          ...member,
          user: userMap.get(member.user_id)
        })),
      member_count: parseInt(workspace.member_count) || 0
    }));

    // 5. Get current user's current_workspace_id
    // requireAdmin already verified user exists
    const adminUserResult = await pool.query(
      'SELECT current_workspace_id FROM users WHERE id = $1',
      [user.id]
    );
    const currentWorkspaceId = adminUserResult.rows[0]?.current_workspace_id;

    return NextResponse.json({
      workspaces: enrichedWorkspaces,
      total: enrichedWorkspaces.length,
      currentWorkspaceId
    });

  } catch (error: any) {
    console.error('Server error fetching workspaces:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Require admin authentication
  const { error: authError, user } = await requireAdmin(request);
  if (authError) return authError;
  if (!user) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

  // Check super admin strictly for actions
  if (!SUPER_ADMIN_EMAILS.includes(user.email || '')) {
    return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action, targetWorkspaceId, originalWorkspaceId, userId, role, workspaceId, permissionType } = body;

    switch (action) {
      case 'switch_workspace':
        return await switchToWorkspace(targetWorkspaceId);

      case 'grant_permission':
        // Mock impl as in original
        return NextResponse.json({
          success: true,
          message: `Would grant ${permissionType} permission to workspace ${workspaceId} for user ${userId}`
        });

      case 'get_accessible_workspaces':
        return await getAccessibleWorkspaces();

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Admin workspaces POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function switchToWorkspace(targetWorkspaceId: string) {
  try {
    // Get workspace details
    const wsResult = await pool.query(
      'SELECT id, name, slug, owner_id as user_id FROM workspaces WHERE id = $1',
      [targetWorkspaceId]
    );
    const workspace = wsResult.rows[0];

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get campaigns
    const campaignsResult = await pool.query(
      'SELECT id, name, status, created_at FROM campaigns WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 10',
      [targetWorkspaceId]
    );

    return NextResponse.json({
      success: true,
      workspace,
      campaigns: campaignsResult.rows || [],
      message: `Switched to workspace: ${workspace.name}`,
      adminNote: `You are now managing ${workspace.name} on behalf of the workspace owner`
    });
  } catch (error) {
    console.error('Error switching workspace:', error);
    return NextResponse.json({ error: 'Failed to switch workspace' }, { status: 500 });
  }
}

async function getAccessibleWorkspaces() {
  try {
    // Super admins see all workspaces
    const wsResult = await pool.query(
      'SELECT id, name, slug, owner_id as user_id, created_at FROM workspaces ORDER BY created_at DESC'
    );
    const workspaces = wsResult.rows;

    // Get owners
    const ownerIds = [...new Set(workspaces.map(w => w.user_id).filter(Boolean))];
    const userMap = new Map();

    if (ownerIds.length > 0) {
      const usersResult = await pool.query(
        'SELECT id, email FROM users WHERE id = ANY($1::text[])',
        [ownerIds]
      );
      usersResult.rows.forEach(u => userMap.set(u.id, u));
    }

    const enrichedWorkspaces = workspaces.map((workspace: any) => ({
      ...workspace,
      owner: userMap.get(workspace.user_id),
      access_type: 'admin',
      permission_level: 'admin'
    }));

    return NextResponse.json({
      success: true,
      workspaces: enrichedWorkspaces,
      userRole: 'admin'
    });
  } catch (error) {
    console.error('Error getting accessible workspaces:', error);
    return NextResponse.json({ error: 'Failed to get workspaces' }, { status: 500 });
  }
}
