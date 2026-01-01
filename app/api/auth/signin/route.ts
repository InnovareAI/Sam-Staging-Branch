import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';
import { pool } from '@/lib/db';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'session';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    console.log('Signing in user with Firebase Auth:', { email });

    try {
      // Sign in with Firebase client SDK to get ID token
      const auth = getFirebaseAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // Create session cookie using Admin SDK
      const adminAuth = getAdminAuth();
      const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
      const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

      // Get user from database
      const userResult = await pool.query(
        `SELECT id, email, first_name, last_name FROM users WHERE id = $1`,
        [userCredential.user.uid]
      );

      let dbUser = userResult.rows[0];

      // Create user if not exists
      if (!dbUser) {
        await pool.query(
          `INSERT INTO users (id, email, first_name, last_name, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
          [userCredential.user.uid, email, '', '']
        );
        dbUser = { id: userCredential.user.uid, email, first_name: '', last_name: '' };
      }

      // Set the session cookie
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: expiresIn / 1000,
        path: '/'
      });

      console.log('User signed in successfully:', userCredential.user.uid);

      return NextResponse.json({
        message: 'Sign-in successful!',
        user: {
          id: userCredential.user.uid,
          email: userCredential.user.email,
          firstName: dbUser?.first_name,
          lastName: dbUser?.last_name
        }
      });

    } catch (authError: any) {
      console.error('Firebase signin error:', authError);

      // Handle specific error types
      if (authError.code === 'auth/invalid-credential' || authError.code === 'auth/wrong-password' || authError.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      if (authError.code === 'auth/user-disabled') {
        return NextResponse.json(
          { error: 'This account has been disabled' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: authError.message || 'Sign-in failed' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Signin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during sign-in' },
      { status: 500 }
    );
  }
}

// Handle GET requests - redirect to signin page
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const error = searchParams.get('error');

  const signinUrl = new URL('/signin', request.url);
  if (error) {
    signinUrl.searchParams.set('error', error);
  }

  return NextResponse.redirect(signinUrl);
}