import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { detectCorruptedCookiesInRequest, clearAllAuthCookies } from '@/lib/auth/cookie-cleanup';

/**
 * Authentication Helper for API Routes
 * Ensures user is authenticated before accessing protected endpoints
 */
export async function requireAuth(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // DISABLED: Cookie cleanup was breaking fresh signin cookies
    // Let Supabase SSR handle all cookie operations natively

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie setting can fail in middleware/API route context
            }
          }
        },
        cookieOptions: {
          // CRITICAL: Must match browser client configuration
          global: {
            secure: true, // Always true for HTTPS
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days in seconds
          }
        }
      }
    );

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
    console.error('[Route Auth] Auth check failed:', error);

    // If cookie parsing fails, clear all cookies and return 401
    const response = NextResponse.json(
      {
        error: 'Authentication failed',
        message: 'Your session is invalid. Please sign in again.'
      },
      { status: 401 }
    );

    clearAllAuthCookies(response);

    return {
      error: response,
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
    // CRITICAL: Check for super admin emails FIRST (before workspace membership check)
    // Super admins don't need workspace membership to access admin routes
    const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user!.email || '');

    if (isSuperAdmin) {
      return {
        error: null,
        user,
        session,
        isAdmin: true
      };
    }

    // For non-super admins, check workspace membership
    const cookieStore2 = await cookies();
    const supabase2 = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore2.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore2.set(name, value, options)
              );
            } catch {
              // Cookie setting can fail in middleware/API route context
            }
          }
        },
        cookieOptions: {
          global: {
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7
          }
        }
      }
    );

    // Check if user has admin role in any workspace
    const { data: memberships } = await supabase2
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
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie setting can fail in middleware/API route context
            }
          }
        },
        cookieOptions: {
          global: {
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7
          }
        }
      }
    );

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
