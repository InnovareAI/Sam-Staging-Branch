import { createClient } from '@/app/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * Force login endpoint for dev mode
 * GET /api/auth/force-login?email=xxx&password=xxx
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const password = searchParams.get('password');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    console.log('🔐 Force login attempt for:', email);

    // Sign in with email/password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Login failed:', error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    console.log('✅ Login successful!');
    console.log('User ID:', data.user?.id);
    console.log('Email:', data.user?.email);

    return NextResponse.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
      session: {
        access_token: data.session?.access_token ? '***' : null,
        expires_at: data.session?.expires_at,
      },
      message: 'Logged in successfully! Refresh the page.',
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
