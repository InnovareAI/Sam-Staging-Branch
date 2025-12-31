import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * Firebase Session API
 * Creates/validates/destroys server-side sessions from Firebase ID tokens
 */

// Session cookie name
const SESSION_COOKIE_NAME = 'session';

// Session duration: 7 days
const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000;

/**
 * POST: Create session from Firebase ID token
 */
export async function POST(request: NextRequest) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json(
                { error: 'Missing ID token' },
                { status: 400 }
            );
        }

        // Verify the ID token
        const auth = getAdminAuth();
        let decodedToken;

        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (err) {
            console.error('ID token verification failed:', err);
            return NextResponse.json(
                { error: 'Invalid ID token' },
                { status: 401 }
            );
        }

        // Create session cookie
        const sessionCookie = await auth.createSessionCookie(idToken, {
            expiresIn: SESSION_DURATION_MS,
        });

        // Set the session cookie
        const cookieStore = await cookies();
        cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: SESSION_DURATION_MS / 1000,
            path: '/',
        });

        // Also store user info
        return NextResponse.json({
            message: 'Session created',
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
            },
        });

    } catch (error) {
        console.error('Session creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create session' },
            { status: 500 }
        );
    }
}

/**
 * GET: Verify current session
 */
export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

        if (!sessionCookie) {
            return NextResponse.json(
                { error: 'No session' },
                { status: 401 }
            );
        }

        // Verify session cookie
        const auth = getAdminAuth();

        try {
            const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

            return NextResponse.json({
                user: {
                    uid: decodedClaims.uid,
                    email: decodedClaims.email,
                },
            });
        } catch (err) {
            // Session is invalid or expired
            cookieStore.delete(SESSION_COOKIE_NAME);
            return NextResponse.json(
                { error: 'Session expired' },
                { status: 401 }
            );
        }

    } catch (error) {
        console.error('Session verification error:', error);
        return NextResponse.json(
            { error: 'Failed to verify session' },
            { status: 500 }
        );
    }
}

/**
 * DELETE: Sign out - destroy session
 */
export async function DELETE() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

        if (sessionCookie) {
            // Optionally revoke the session on Firebase side
            try {
                const auth = getAdminAuth();
                const decodedClaims = await auth.verifySessionCookie(sessionCookie);
                await auth.revokeRefreshTokens(decodedClaims.uid);
            } catch {
                // Ignore errors - session might already be invalid
            }
        }

        // Delete the session cookie
        cookieStore.delete(SESSION_COOKIE_NAME);

        return NextResponse.json({ message: 'Signed out' });

    } catch (error) {
        console.error('Sign out error:', error);
        return NextResponse.json(
            { error: 'Failed to sign out' },
            { status: 500 }
        );
    }
}
