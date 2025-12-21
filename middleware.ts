import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
// NOTE: Cookie cleanup imports removed - aggressive cleanup was causing constant logouts

// Super admin emails - only these users can access /admin routes
// NOTE: No shared workspaces exist - each user has their own workspace
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Skip middleware for API routes - they handle their own auth
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return response;
  }

  // NOTE: Aggressive cookie cleanup was disabled (Nov 2025) because it was
  // causing constant logouts for users with valid sessions. If client creation
  // fails (line 65-71), we allow the request through and let pages handle auth.

  // CRITICAL: Create Supabase client with middleware cookie handling
  let supabase;
  try {
    supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          }
        },
        cookieOptions: {
          // CRITICAL: Must match browser and server client configuration
          global: {
            secure: true, // Always true for HTTPS
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7 // 7 days in seconds
          }
        }
      }
    );
  } catch (clientError) {
    console.error('[Middleware] Failed to create Supabase client - likely cookie parsing error:', clientError);

    // Just let the request through - don't clear cookies
    // Let individual pages handle auth
    console.warn('[Middleware] Allowing request through despite client creation error');
    return response;
  }

  // ROOT URL REWRITE: Make chat the default view (Dec 21, 2025)
  // Rewrite "/" to "/workspace/[id]/chat" for authenticated users
  // This keeps the URL as app.meet-sam.com while serving the chat interface
  if (request.nextUrl.pathname === '/') {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (!authError && user) {
        // Get user's personal workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .eq('workspace_type', 'personal')
          .single();

        if (workspace) {
          // Rewrite to workspace chat (URL stays as "/")
          const chatUrl = new URL(`/workspace/${workspace.id}/chat`, request.url);
          console.log(`[Middleware] Rewriting / to ${chatUrl.pathname} for user ${user.email}`);
          return NextResponse.rewrite(chatUrl);
        }
      }
      // If not authenticated or no workspace, fall through to show dashboard/login
    } catch (error) {
      console.error('[Middleware] Error in root URL rewrite:', error);
      // Fall through to default behavior
    }
  }

  // Check if this is an admin route
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // All admin routes require authentication + InnovareAI workspace membership
    // (bypass removed Nov 25, 2025 - was security vulnerability)

    try {
      // Get user from session
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // Not authenticated - redirect to login WITHOUT clearing cookies
        // Let the user try to sign in again with existing cookies
        console.warn('[Middleware] Auth error on admin route:', authError?.message);
        const loginUrl = new URL('/', request.url);
        loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);

        response = NextResponse.redirect(loginUrl);
        // DO NOT clear cookies - this was causing constant logouts
        return response;
      }

      // Check if user is a super admin (by email)
      // NOTE: No shared workspaces - admin access is email-based only
      const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '');

      if (!isSuperAdmin) {
        // User is not a super admin - show 403 error
        return new NextResponse(
          JSON.stringify({
            error: 'Forbidden',
            message: 'Access to admin routes is restricted to super admins only.'
          }),
          {
            status: 403,
            headers: { 'content-type': 'application/json' }
          }
        );
      }

    } catch (error) {
      console.error('[Middleware] Auth middleware error:', error);
      // DO NOT clear cookies - just redirect to home
      const loginUrl = new URL('/', request.url);
      response = NextResponse.redirect(loginUrl);
      return response;
    }
  }

  // Return response with updated cookies
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
