import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Authentication Helper for API Routes
 * Ensures user is authenticated before accessing protected endpoints
 */
export async function requireAuth(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return {
        error: NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        ),
        user: null,
        session: null
      };
    }

    return {
      error: null,
      user: session.user,
      session
    };
  } catch (error) {
    console.error('Auth check failed:', error);
    return {
      error: NextResponse.json(
        { error: 'Authentication failed' },
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

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check if user has admin role in any workspace
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user!.id)
      .in('role', ['admin', 'owner']);

    const isAdmin = memberships && memberships.length > 0;

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

  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user!.id)
      .single();

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
