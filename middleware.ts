import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple pass-through middleware - all authentication is handled at page level with Supabase
export default function middleware(req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};