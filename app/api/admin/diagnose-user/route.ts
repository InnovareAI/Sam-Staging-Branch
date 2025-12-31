import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

/**
 * Diagnostic endpoint to check user authentication and workspace access
 */
export async function GET(request: NextRequest) {
  try {
    // Try to verify auth
    let userId: string | null = null;
    let userEmail: string | null = null;

    try {
      const authResult = await verifyAuth(request);
      userId = authResult.userId;
      userEmail = authResult.userEmail;
    } catch (authError: any) {
      return NextResponse.json({
        authenticated: false,
        error: authError?.message || 'No user session'
      });
    }

    // Get user profile
    const profileResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    const profile = profileResult.rows[0];

    // Get workspace memberships using direct query (not join)
    const membershipsResult = await pool.query(
      'SELECT * FROM workspace_members WHERE user_id = $1',
      [userId]
    );
    const memberships = membershipsResult.rows;

    // Get workspaces separately
    let workspaces: any[] = [];
    if (memberships && memberships.length > 0) {
      const workspaceIds = memberships.map(m => m.workspace_id);
      const workspacesResult = await pool.query(
        'SELECT * FROM workspaces WHERE id = ANY($1)',
        [workspaceIds]
      );
      workspaces = workspacesResult.rows || [];
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: userId,
        email: userEmail
      },
      profile: profile || null,
      profileError: profile ? null : 'Profile not found',
      memberships: memberships || [],
      membershipError: memberships?.length ? null : 'No memberships found',
      workspaces: workspaces,
      diagnosis: {
        hasProfile: !!profile,
        hasMemberships: memberships && memberships.length > 0,
        membershipCount: memberships?.length || 0,
        workspaceCount: workspaces.length,
        currentWorkspaceId: profile?.current_workspace_id || null
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
