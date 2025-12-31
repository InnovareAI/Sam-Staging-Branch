import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Super admin emails - only these users can access /admin routes
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/session',
  '/api/auth/firebase-session',
  '/api/webhooks',
  '/_next',
  '/favicon.ico',
  '/public'
];

export async function proxy(request: NextRequest) {
  // Create response with pathname header for route detection in layouts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Skip middleware for API routes - they handle their own auth
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return response;
  }

  // Check for public paths
  const isPublicPath = PUBLIC_PATHS.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isPublicPath) {
    return response;
  }

  // Check for Firebase session cookie
  const session = request.cookies.get('session');

  if (!session) {
    // Redirect to login if no session
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // CLEAN URL REWRITE: Serve chat at / and /chat
  // Rewrite "/" and "/chat" to "/workspace/[id]/chat" for authenticated users
  if (request.nextUrl.pathname === '/chat' || request.nextUrl.pathname === '/') {
    const hasTabParam = request.nextUrl.searchParams.has('tab') || request.nextUrl.searchParams.has('section');

    if (request.nextUrl.pathname === '/chat' || !hasTabParam) {
      // Check for cached workspace ID in cookie (fast path)
      const cachedWorkspaceId = request.cookies.get('lastWorkspaceId')?.value;

      if (cachedWorkspaceId) {
        const chatUrl = new URL(`/workspace/${cachedWorkspaceId}/chat`, request.url);
        const rewriteHeaders = new Headers(request.headers);
        rewriteHeaders.set('x-pathname', chatUrl.pathname);
        console.log(`[Proxy] Rewriting to cached workspace: ${chatUrl.pathname}`);
        return NextResponse.rewrite(chatUrl, {
          request: { headers: rewriteHeaders }
        });
      }
      // If no cached workspace, let the page handle workspace resolution
    }
  }

  // Check if this is an admin route
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Admin routes require super admin email
    // Note: Full email verification happens server-side via Firebase Admin SDK
    // This is just a first-line defense - API calls verify the actual session

    // For admin routes without session, redirect to login
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Note: Full admin permission check happens server-side
    // The proxy can't verify Firebase session without calling Firebase Admin SDK
    // which is not available in Edge runtime
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
