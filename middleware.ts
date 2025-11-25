import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
// NOTE: Cookie cleanup imports removed - aggressive cleanup was causing constant logouts

// InnovareAI workspace ID - only members of this workspace can access /admin routes
const INNOVARE_AI_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

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

      // Check if user is a member of InnovareAI workspace
      // CRITICAL: Use service role to bypass RLS for middleware auth check
      const supabaseAdmin = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
          }
        }
      );

      const { data: membership, error: memberError } = await supabaseAdmin
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
