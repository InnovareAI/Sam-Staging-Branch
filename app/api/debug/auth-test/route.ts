import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting auth debug test...');

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    console.log('📋 All cookies:', allCookies.map(c => ({
      name: c.name,
      hasValue: !!c.value,
      valueStart: c.value?.substring(0, 20)
    })));

    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    console.log('🔐 Calling getUser()...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log('👤 Auth result:', {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      error: authError?.message
    });

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        error: authError?.message || 'No user found',
        cookies: allCookies.map(c => ({
          name: c.name,
          hasValue: !!c.value
        })),
        details: 'Authentication failed - check if user is signed in'
      }, { status: 200 }); // Return 200 so we can see the response
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email
      },
      cookies: allCookies.map(c => ({
        name: c.name,
        hasValue: !!c.value
      }))
    });

  } catch (error) {
    console.error('❌ Auth test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
