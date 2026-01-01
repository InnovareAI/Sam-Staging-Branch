import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'session';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      console.log('📝 No session cookie found');
      return NextResponse.json({
        user: null,
        session: null,
        authenticated: false
      });
    }

    console.log('🔍 Auth Session: Verifying Firebase session...');

    try {
      const adminAuth = getAdminAuth();
      const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);

      // Get user from database
      const userResult = await pool.query(
        `SELECT id, email, first_name, last_name, created_at FROM users WHERE id = $1`,
        [decodedToken.uid]
      );

      const dbUser = userResult.rows[0];

      console.log('✅ Active session found for user:', decodedToken.uid);

      return NextResponse.json({
        user: {
          id: decodedToken.uid,
          email: decodedToken.email,
          firstName: dbUser?.first_name,
          lastName: dbUser?.last_name,
          lastSignInAt: decodedToken.auth_time ? new Date(decodedToken.auth_time * 1000).toISOString() : null
        },
        session: {
          accessToken: sessionCookie,
          expiresAt: decodedToken.exp,
        },
        authenticated: true
      });
    } catch (verifyError) {
      console.log('❌ Session verification failed:', verifyError);
      return NextResponse.json({
        user: null,
        session: null,
        authenticated: false
      });
    }

  } catch (error) {
    console.error('❌ Session API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'ID token required' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();

    // Verify the ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    // Create session cookie (5 days)
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Create or update user in database
    await pool.query(
      `INSERT INTO users (id, email, first_name, last_name, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         updated_at = NOW()`,
      [decodedToken.uid, decodedToken.email, decodedToken.name?.split(' ')[0] || '', decodedToken.name?.split(' ').slice(1).join(' ') || '']
    );

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000,
      path: '/'
    });

    return NextResponse.json({
      success: true,
      user: {
        id: decodedToken.uid,
        email: decodedToken.email
      }
    });

  } catch (error) {
    console.error('❌ Session creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Session deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}