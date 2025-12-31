/**
 * Debug endpoint to inspect cookies and auth state
 * Updated for Firebase authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    // Get all cookies from request
    const requestCookies = req.cookies.getAll();

    // Get cookies from server
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    // Try to verify session if present
    let sessionInfo = null;
    let userInfo = null;

    if (sessionCookie) {
      try {
        const auth = getAdminAuth();
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
        sessionInfo = {
          valid: true,
          expiresAt: decodedClaims.exp,
          issuedAt: decodedClaims.iat,
          authTime: decodedClaims.auth_time
        };
        userInfo = {
          uid: decodedClaims.uid,
          email: decodedClaims.email,
          emailVerified: decodedClaims.email_verified
        };
      } catch (error) {
        sessionInfo = {
          valid: false,
          error: error instanceof Error ? error.message : 'Session verification failed'
        };
      }
    }

    return NextResponse.json({
      cookies: requestCookies.map(c => ({
        name: c.name,
        value: c.value.substring(0, 20) + '...', // Truncate for security
        hasValue: !!c.value
      })),
      firebaseCookies: requestCookies
        .filter(c => c.name === 'session')
        .map(c => ({
          name: c.name,
          length: c.value.length,
          preview: c.value.substring(0, 30) + '...'
        })),
      auth: {
        hasSession: !!sessionCookie,
        sessionInfo,
        userInfo
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
