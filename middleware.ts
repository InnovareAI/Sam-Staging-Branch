import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk",
  "/api/test-simple",
  "/api/test-auth",
  "/api/test-email",
  "/api/test-sam",
]);

const isSamApiRoute = createRouteMatcher([
  "/api/sam/(.*)",
]);

// Check if Clerk is configured
const isClerkConfigured = 
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && 
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'your_publishable_key_here';

// Use Clerk middleware if configured, otherwise pass through
const middleware = isClerkConfigured 
  ? clerkMiddleware(async (auth, req) => {
      // Allow Sam API routes through without forcing protection,
      // but still provide auth context so the routes can check authentication themselves
      if (!isPublicRoute(req) && !isSamApiRoute(req)) {
        await auth.protect();
      }
    })
  : (req: NextRequest) => NextResponse.next();

export default middleware;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};