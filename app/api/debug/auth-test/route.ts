import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    console.log('Starting auth debug test...');

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    console.log('All cookies:', allCookies.map(c => ({
      name: c.name,
      hasValue: !!c.value,
      valueStart: c.value?.substring(0, 20)
    })));

    // Try to verify auth with Firebase
    console.log('Calling verifyAuth()...');
    const authContext = await verifyAuth(request);

    console.log('Auth result:', {
      hasUser: true,
      userId: authContext.userId,
      email: authContext.userEmail,
      workspaceId: authContext.workspaceId
    });

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: authContext.userId,
        email: authContext.userEmail
      },
      workspace: {
        id: authContext.workspaceId,
        role: authContext.workspaceRole
      },
      cookies: allCookies.map(c => ({
        name: c.name,
        hasValue: !!c.value
      }))
    });

  } catch (error) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authErr = error as AuthError;
      console.log('Auth result:', {
        hasUser: false,
        error: authErr.message
      });

      return NextResponse.json({
        success: false,
        authenticated: false,
        error: authErr.message,
        cookies: allCookies.map(c => ({
          name: c.name,
          hasValue: !!c.value
        })),
        details: 'Authentication failed - check if user is signed in'
      }, { status: 200 }); // Return 200 so we can see the response
    }

    console.error('Auth test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
