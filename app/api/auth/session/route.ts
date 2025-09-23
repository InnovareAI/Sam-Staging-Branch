import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    console.log('🔍 Auth Session: Checking current session...');
    
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Session error:', error);
      return NextResponse.json(
        { error: 'Failed to get session' },
        { status: 500 }
      );
    }
    
    if (!session) {
      console.log('📝 No active session found');
      return NextResponse.json({
        user: null,
        session: null,
        authenticated: false
      });
    }
    
    console.log('✅ Active session found for user:', session.user.id);
    
    // Return session information
    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.user_metadata?.first_name,
        lastName: session.user.user_metadata?.last_name,
        lastSignInAt: session.user.last_sign_in_at
      },
      session: {
        accessToken: session.access_token,
        expiresAt: session.expires_at,
        refreshToken: session.refresh_token
      },
      authenticated: true
    });
    
  } catch (error) {
    console.error('❌ Session API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}