import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment';
import { detectCorruptedCookiesInRequest, clearAllAuthCookies } from '@/lib/auth/cookie-cleanup';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'session';

/**
 * Auth Callback Route
 * Handles OAuth callbacks and token exchanges for Firebase Auth
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const customToken = requestUrl.searchParams.get('token');

  // AUTOMATIC COOKIE CLEANUP: Clear any corrupted cookies before processing callback
  const allCookies = request.cookies.getAll();
  const corruptedCookies = detectCorruptedCookiesInRequest(allCookies);

  if (corruptedCookies.length > 0) {
    console.warn('[Auth Callback] Detected corrupted cookies - clearing before processing');
  }

  // Handle authentication errors
  if (error) {
    console.error('Auth callback error:', error, errorDescription);

    if (error === 'access_denied' && errorDescription?.includes('expired')) {
      const response = NextResponse.redirect(
        new URL('/signin?error=reset_expired&message=' + encodeURIComponent('Your password reset link has expired. Please request a new one.'), request.url)
      );
      clearAllAuthCookies(response);
      return response;
    }

    const response = NextResponse.redirect(
      new URL('/signin?error=' + error, request.url)
    );
    clearAllAuthCookies(response);
    return response;
  }

  // Handle recovery flow
  if (type === 'recovery' && code) {
    console.log('🔑 Recovery flow detected - passing code to reset password page');
    const resetUrl = new URL('/reset-password', request.url);
    resetUrl.searchParams.set('code', code);
    resetUrl.searchParams.set('type', 'recovery');
    return NextResponse.redirect(resetUrl);
  }

  // Handle Firebase custom token exchange
  if (customToken) {
    try {
      const adminAuth = getAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(customToken);

      // Create session cookie
      const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
      const sessionCookie = await adminAuth.createSessionCookie(customToken, { expiresIn });

      // Ensure user exists in database
      const userResult = await pool.query(
        `SELECT id, email, first_name, last_name, current_workspace_id FROM users WHERE id = $1`,
        [decodedToken.uid]
      );

      let user = userResult.rows[0];

      if (!user) {
        // Create user profile
        await pool.query(
          `INSERT INTO users (id, email, first_name, last_name, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [decodedToken.uid, decodedToken.email, decodedToken.name?.split(' ')[0] || '', decodedToken.name?.split(' ').slice(1).join(' ') || '']
        );

        user = { id: decodedToken.uid, email: decodedToken.email };
      }

      // Create workspace if user doesn't have one
      if (!user.current_workspace_id) {
        try {
          const workspaceName = `${user.first_name || 'User'}'s Workspace`;
          const workspaceSlug = `workspace-${decodedToken.uid.substring(0, 8)}`;

          const wsResult = await pool.query(
            `INSERT INTO workspaces (name, slug, owner_id, created_by)
             VALUES ($1, $2, $3, $3)
             RETURNING id`,
            [workspaceName, workspaceSlug, decodedToken.uid]
          );

          const workspaceId = wsResult.rows[0]?.id;

          if (workspaceId) {
            await pool.query(
              `INSERT INTO workspace_members (workspace_id, user_id, role)
               VALUES ($1, $2, 'owner')`,
              [workspaceId, decodedToken.uid]
            );

            await pool.query(
              `UPDATE users SET current_workspace_id = $1, updated_at = NOW() WHERE id = $2`,
              [workspaceId, decodedToken.uid]
            );

            console.log('✅ Created personal workspace for user');
          }
        } catch (wsErr) {
          console.error('⚠️ Workspace creation error (non-critical):', wsErr);
        }
      }

      // Assign dedicated IP if needed
      try {
        const proxyResult = await pool.query(
          `SELECT id FROM user_proxy_preferences WHERE user_id = $1`,
          [decodedToken.uid]
        );

        if (proxyResult.rows.length === 0) {
          console.log('🌍 Assigning dedicated IP for user...');

          const autoIPService = new AutoIPAssignmentService();
          const userLocation = await autoIPService.detectUserLocation(request);
          const proxyConfig = await autoIPService.generateOptimalProxyConfig(userLocation || undefined);

          await pool.query(
            `INSERT INTO user_proxy_preferences 
             (user_id, detected_location, preferred_country, preferred_state, preferred_city, confidence_score, session_id, is_auto_assigned, created_at, last_updated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())`,
            [
              decodedToken.uid,
              userLocation ? `${userLocation.city}, ${userLocation.regionName}, ${userLocation.country}` : null,
              proxyConfig.country,
              proxyConfig.state,
              proxyConfig.city,
              proxyConfig.confidence,
              proxyConfig.sessionId
            ]
          );

          console.log('✅ Assigned dedicated IP');
        }
      } catch (ipErr) {
        console.error('⚠️ IP assignment failed (non-critical):', ipErr);
      }

      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: expiresIn / 1000,
        path: '/'
      });

      console.log('✅ Auth callback successful for user:', decodedToken.uid);
      return NextResponse.redirect(new URL('/', request.url));

    } catch (tokenErr) {
      console.error('[Auth Callback] Token verification error:', tokenErr);
      const response = NextResponse.redirect(
        new URL('/signin?error=callback_error&message=' + encodeURIComponent('Authentication failed. Please try signing in again.'), request.url)
      );
      clearAllAuthCookies(response);
      return response;
    }
  }

  // Handle magic link type
  if (type === 'magiclink') {
    console.log('Magic link callback - redirecting to app');
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If no valid parameters, redirect to signin
  console.log('[Auth Callback] No valid parameters, redirecting to signin');
  const response = NextResponse.redirect(new URL('/signin', request.url));
  clearAllAuthCookies(response);
  return response;
}