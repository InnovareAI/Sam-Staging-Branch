import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

/**
 * GET /api/workspace/[workspaceId]
 * Fetch workspace details including name, members, and subscription info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    // 1. Authenticate
    const { userId } = await verifyAuth(request);
    const { workspaceId } = params;

    // 2. Verify Member Access
    const memberResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );
    const member = memberResult.rows[0];

    if (!member) {
      return NextResponse.json({ error: 'Forbidden: Not a member of this workspace' }, { status: 403 });
    }

    // 3. Fetch Workspace Details
    const workspaceResult = await pool.query(
      'SELECT id, name, slug, created_at, owner_id FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    const workspace = workspaceResult.rows[0];

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // 4. Fetch Members Count
    const countResult = await pool.query(
      'SELECT count(*) FROM workspace_members WHERE workspace_id = $1',
      [workspaceId]
    );
    const memberCount = parseInt(countResult.rows[0].count);

    // 5. Fetch Subscription
    const subResult = await pool.query(
      'SELECT status, plan, trial_end FROM workspace_subscriptions WHERE workspace_id = $1',
      [workspaceId]
    );
    const subscription = subResult.rows[0];

    return NextResponse.json({
      workspace: {
        ...workspace,
        memberCount: memberCount || 1,
        subscription: subscription || null,
        userRole: member.role
      }
    });

  } catch (error: any) {
    console.error('Workspace fetch error:', error);
    const status = error.message?.includes('Authentication') ? 401 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to fetch workspace' },
      { status }
    );
  }
}
