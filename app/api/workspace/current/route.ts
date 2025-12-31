import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

// Super admin emails with cross-tenant access
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function GET(request: NextRequest) {
  try {
    // Verify auth with Firebase
    const authContext = await verifyAuth(request);
    const userId = authContext.userId;
    const userEmail = authContext.userEmail;

    // Get user's current workspace from users table
    const userResult = await pool.query(
      'SELECT current_workspace_id FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.current_workspace_id) {
      return NextResponse.json({
        success: false,
        error: 'No workspace found'
      }, { status: 404 });
    }

    const currentWorkspaceId = userResult.rows[0].current_workspace_id;

    // CRITICAL: Verify user is actually a member of this workspace
    // EXCEPTION: Super admins can access any workspace
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail || '');

    if (!isSuperAdmin) {
      const membershipResult = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [currentWorkspaceId, userId]
      );

      if (membershipResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Access denied - not a workspace member'
        }, { status: 403 });
      }
    }

    // Get workspace details
    const workspaceResult = await pool.query(
      'SELECT id, name, company_name FROM workspaces WHERE id = $1',
      [currentWorkspaceId]
    );

    if (workspaceResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Workspace not found'
      }, { status: 404 });
    }

    const workspace = workspaceResult.rows[0];

    return NextResponse.json({
      success: true,
      workspace: {
        id: workspace.id,
        name: workspace.name || workspace.company_name || 'Unknown'
      }
    });

  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      return NextResponse.json({
        success: false,
        error: authErr.message
      }, { status: authErr.statusCode });
    }

    console.error('Current workspace API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
