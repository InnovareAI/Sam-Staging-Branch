import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Emergency endpoint to clear corrupted Supabase sessions
 * Use when session cookies are corrupted and preventing login
 */
export async function POST() {
  try {
    const cookieStore = await cookies();

    // Clear all Supabase auth cookies
    const supabaseCookies = [
      'sb-access-token',
      'sb-refresh-token',
      'sb-auth-token',
      'supabase-auth-token',
      'sb-latxadqrvrrrcvkktrog-auth-token',
      'sb-latxadqrvrrrcvkktrog-auth-token-code-verifier'
    ];

    supabaseCookies.forEach(name => {
      cookieStore.set(name, '', {
        maxAge: 0,
        path: '/',
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Session cleared. Please sign in again.',
      cleared: supabaseCookies.length
    });
  } catch (error) {
    console.error('Error clearing session:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear session'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to clear session cookies',
    method: 'POST'
  });
}
