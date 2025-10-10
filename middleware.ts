import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// InnovareAI workspace ID - only members of this workspace can access /admin routes
const INNOVARE_AI_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // CRITICAL: Create Supabase client with middleware cookie handling
  const supabase = createServerClient(
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
      }
    }
  );

  // Refresh session (updates cookies if needed)
  await supabase.auth.getUser();

  // Check if this is an admin route
  if (request.nextUrl.pathname.startsWith('/admin')) {
    try {
      // Get user from session
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        // Not authenticated - redirect to login
        const loginUrl = new URL('/', request.url);
        loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
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
      console.error('Auth middleware error:', error);
      // On error, redirect to login for safety
      const loginUrl = new URL('/', request.url);
      return NextResponse.redirect(loginUrl);
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
