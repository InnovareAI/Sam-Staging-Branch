import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';

/**
 * Authentication Helper for API Routes
 * Ensures user is authenticated before accessing protected endpoints
 */
export async function requireAuth(request: NextRequest) {
  try {
    const { userId, userEmail } = await verifyAuth(request);

    return {
      error: null,
      user: { id: userId, email: userEmail },
      session: { user: { id: userId, email: userEmail } } // Mock session for compatibility
    };
  } catch (error: any) {
    console.error('[Route Auth] Auth check failed:', error);

    return {
      error: NextResponse.json(
        {
          error: 'Authentication failed',
          message: error.message || 'Your session is invalid. Please sign in again.'
        },
        { status: 401 }
      ),
      user: null,
      session: null
    };
  }
}

/**
 * Admin Authentication Helper
 * Checks if user is authenticated AND has admin role
 */
export async function requireAdmin(request: NextRequest) {
  const { error, user, session } = await requireAuth(request);

  if (error) return { error, user: null, session: null, isAdmin: false };
  if (!user) return { error: NextResponse.json({ error: 'Auth failed' }, { status: 401 }), user: null, session: null, isAdmin: false };

  try {
    // CRITICAL: Check for super admin emails FIRST
    const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email || '');

    if (isSuperAdmin) {
      return {
        error: null,
        user,
        session,
        isAdmin: true
      };
    }

    // For non-super admins, check if they are admin in ANY workspace
    // Using direct PG pool instead of Supabase client
    const memberResult = await pool.query(
      "SELECT 1 FROM workspace_members WHERE user_id = $1 AND role IN ('admin', 'owner') LIMIT 1",
      [user.id]
    );

    const isAdmin = memberResult.rowCount ? memberResult.rowCount > 0 : false;

    if (!isAdmin) {
      return {
        error: NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        ),
        user: null,
        session: null,
        isAdmin: false
      };
    }

    return {
      error: null,
      user,
      session,
      isAdmin: true
    };
  } catch (error) {
    console.error('Admin check failed:', error);
    return {
      error: NextResponse.json(
        { error: 'Authorization check failed' },
        { status: 500 }
      ),
      user: null,
      session: null,
      isAdmin: false
    };
  }
}

/**
 * Workspace Access Helper
 * Ensures user has access to specified workspace
 */
export async function requireWorkspaceAccess(
  request: NextRequest,
  workspaceId: string
) {
  const { error, user, session } = await requireAuth(request);

  if (error) return { error, user: null, session: null, hasAccess: false };
  if (!user) return { error: NextResponse.json({ error: 'Auth failed' }, { status: 401 }), user: null, session: null, hasAccess: false };

  try {
    const memberResult = await pool.query(
      "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'",
      [workspaceId, user.id]
    );

    const membership = memberResult.rows[0];

    if (!membership) {
      return {
        error: NextResponse.json(
          { error: 'Workspace access denied' },
          { status: 403 }
        ),
        user: null,
        session: null,
        hasAccess: false
      };
    }

    return {
      error: null,
      user,
      session,
      hasAccess: true,
      role: membership.role
    };
  } catch (error) {
    console.error('Workspace access check failed:', error);
    return {
      error: NextResponse.json(
        { error: 'Access check failed' },
        { status: 500 }
      ),
      user: null,
      session: null,
      hasAccess: false
    };
  }
}

/**
 * Environment Check for Test Routes
 * Returns 404 in production for test/debug routes
 */
export function requireNonProduction() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not Found' },
      { status: 404 }
    );
  }
  return null;
}
