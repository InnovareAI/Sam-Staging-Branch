import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple middleware for Supabase Auth - no authentication blocking
export function middleware(request: NextRequest) {
  // Let all requests through - Supabase Auth handles authentication at the component level
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};