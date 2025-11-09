import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { detectCorruptedCookiesInRequest, clearAllAuthCookies } from '@/lib/auth/cookie-cleanup';

// InnovareAI workspace ID - only members of this workspace can access /admin routes
const INNOVARE_AI_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Skip middleware for API routes - they handle their own auth
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return response;
  }

  // AUTOMATIC COOKIE CLEANUP: Detect corrupted cookies before processing
  const allCookies = request.cookies.getAll();
  const corruptedCookies = detectCorruptedCookiesInRequest(allCookies);

  if (corruptedCookies.length > 0) {
    console.warn('[Middleware] Detected corrupted cookies - clearing and redirecting to signin');

    // Redirect to signin with cleared cookies
    const loginUrl = new URL('/signin', request.url);
    loginUrl.searchParams.set('message', 'Your session has expired. Please sign in again.');

    response = NextResponse.redirect(loginUrl);
    clearAllAuthCookies(response);

    return response;
  }

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

    // Clear cookies and redirect to signin
    const loginUrl = new URL('/signin', request.url);
    loginUrl.searchParams.set('message', 'Authentication error. Please sign in again.');

    response = NextResponse.redirect(loginUrl);
    clearAllAuthCookies(response);

    return response;
  }

  // Check if this is an admin route
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // TEMPORARY: Bypass auth for /admin/superadmin to preview redesign
    if (request.nextUrl.pathname === '/admin/superadmin' || request.nextUrl.pathname === '/admin/superadmin-modern') {
      return response;
    }

    try {
      // Get user from session
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // Not authenticated - redirect to login with cleared cookies
        console.warn('[Middleware] Auth error on admin route:', authError?.message);
        const loginUrl = new URL('/', request.url);
        loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);

        response = NextResponse.redirect(loginUrl);
        // Clear cookies if auth failed (might be corrupted)
        if (authError) {
          clearAllAuthCookies(response);
        }
        return response;
      }

      // Check if user is a member of InnovareAI workspace
      const { data: membership, error: memberError } = await supabase
        .from('workspace_members')
        .select('role, status')
        .eq('workspace_id', INNOVARE_AI_WORKSPACE_ID)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (memberError || !membership) {
        // User is not a member of InnovareAI workspace - show 403 error
        return new NextResponse(
          JSON.stringify({
            error: 'Forbidden',
            message: 'Access to admin routes is restricted to InnovareAI workspace members only.'
          }),
          {
            status: 403,
            headers: { 'content-type': 'application/json' }
          }
        );
      }

    } catch (error) {
      console.error('[Middleware] Auth middleware error:', error);
      // On error, clear cookies and redirect to login for safety
      const loginUrl = new URL('/', request.url);
      response = NextResponse.redirect(loginUrl);
      clearAllAuthCookies(response);
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
