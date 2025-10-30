/**
 * Debug endpoint to inspect cookies and auth state
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

export async function GET(req: NextRequest) {
  try {
    // Get all cookies
    const cookies = req.cookies.getAll();

    // Try to create Supabase client
    const supabase = await createSupabaseRouteClient();

    // Try to get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    return NextResponse.json({
      cookies: cookies.map(c => ({
        name: c.name,
        value: c.value.substring(0, 20) + '...', // Truncate for security
        hasValue: !!c.value
      })),
      supabaseCookies: cookies
        .filter(c => c.name.startsWith('sb-'))
        .map(c => ({
          name: c.name,
          length: c.value.length,
          preview: c.value.substring(0, 30) + '...'
        })),
      auth: {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        authError: authError?.message,
        authErrorName: authError?.name
      },
      session: {
        hasSession: !!session,
        expiresAt: session?.expires_at,
        sessionError: sessionError?.message
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
