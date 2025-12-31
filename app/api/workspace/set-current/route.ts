import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'

/**
 * POST /api/workspace/set-current
 * Updates the user's current_workspace_id in the users table
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const { userId, userEmail } = await verifyAuth(request);

    const { workspaceId } = await request.json();

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    console.log('[workspace/set-current] Setting current workspace:', {
      userId,
      userEmail,
      workspaceId
    });

    // 2. Verify Access (Security Check)
    const memberResult = await pool.query(
      "SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'",
      [workspaceId, userId]
    );

    if (memberResult.rows.length === 0) {
      console.error('[workspace/set-current] User not a member of workspace:', workspaceId);
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Update User Record
    await pool.query(
      'UPDATE users SET current_workspace_id = $1, updated_at = NOW() WHERE id = $2',
      [workspaceId, userId]
    );

    console.log('[workspace/set-current] Successfully updated current_workspace_id');

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[workspace/set-current] Exception:', error);
    const status = error.message?.includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status });
  }
}
