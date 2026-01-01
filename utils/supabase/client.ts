/**
 * Firebase-based Supabase compatibility layer (Browser Client)
 * Redirects to Firebase client SDK
 */

import {
    getFirebaseAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    googleProvider,
    type User as FirebaseUser
} from '@/lib/firebase';

interface User {
    id: string;
    email: string | null;
    email_confirmed_at?: string;
    user_metadata?: Record<string, unknown>;
}

interface Session {
    access_token: string;
    user: User;
}

interface AuthChangeEvent {
    event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';
    session: Session | null;
}

function firebaseUserToUser(firebaseUser: FirebaseUser | null): User | null {
    if (!firebaseUser) return null;
    return {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        email_confirmed_at: firebaseUser.emailVerified ? new Date().toISOString() : undefined,
        user_metadata: {
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
        }
    };
}

class FirebaseBrowserAuthClient {
    private auth = getFirebaseAuth();

    async getUser(): Promise<{ data: { user: User | null }; error: Error | null }> {
        try {
            const user = firebaseUserToUser(this.auth.currentUser);
            return { data: { user }, error: null };
        } catch (error) {
            return { data: { user: null }, error: error as Error };
        }
    }

    async getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
        try {
            const firebaseUser = this.auth.currentUser;
            if (!firebaseUser) {
                return { data: { session: null }, error: null };
            }

            const token = await firebaseUser.getIdToken();
            const session: Session = {
                access_token: token,
                user: firebaseUserToUser(firebaseUser)!
            };

            return { data: { session }, error: null };
        } catch (error) {
            return { data: { session: null }, error: error as Error };
        }
    }

    async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
            const result = await signInWithEmailAndPassword(this.auth, email, password);

            // Create session cookie by calling API
            const idToken = await result.user.getIdToken();
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });

            return {
                data: {
                    user: firebaseUserToUser(result.user),
                    session: { access_token: idToken, user: firebaseUserToUser(result.user)! }
                },
                error: null
            };
        } catch (error) {
            return { data: { user: null, session: null }, error: error as Error };
        }
    }

    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
        try {
            const result = await createUserWithEmailAndPassword(this.auth, email, password);

            // Create session cookie 
            const idToken = await result.user.getIdToken();
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, userData: options?.data })
            });

            return {
                data: {
                    user: firebaseUserToUser(result.user),
                    session: { access_token: idToken, user: firebaseUserToUser(result.user)! }
                },
                error: null
            };
        } catch (error) {
            return { data: { user: null, session: null }, error: error as Error };
        }
    }

    async signInWithOAuth({ provider }: { provider: 'google' }) {
        try {
            const authProvider = provider === 'google' ? googleProvider : googleProvider;
            const result = await signInWithPopup(this.auth, authProvider);

            // Create session cookie
            const idToken = await result.user.getIdToken();
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });

            return {
                data: {
                    user: firebaseUserToUser(result.user),
                    session: { access_token: idToken, user: firebaseUserToUser(result.user)! }
                },
                error: null
            };
        } catch (error) {
            return { data: { user: null, session: null }, error: error as Error };
        }
    }

    async signOut() {
        try {
            await firebaseSignOut(this.auth);
            // Clear session cookie
            await fetch('/api/auth/session', { method: 'DELETE' });
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    }

    async resetPasswordForEmail(email: string) {
        try {
            await sendPasswordResetEmail(this.auth, email);
            return { data: {}, error: null };
        } catch (error) {
            return { data: null, error: error as Error };
        }
    }

    onAuthStateChange(callback: (event: string, session: Session | null) => void) {
        return onAuthStateChanged(this.auth, async (firebaseUser) => {
            if (firebaseUser) {
                const token = await firebaseUser.getIdToken();
                const session: Session = {
                    access_token: token,
                    user: firebaseUserToUser(firebaseUser)!
                };
                callback('SIGNED_IN', session);
            } else {
                callback('SIGNED_OUT', null);
            }
        });
    }
}

/**
 * Create a browser client that mimics Supabase client
 */
export function createBrowserClient() {
    return {
        auth: new FirebaseBrowserAuthClient(),
        from: (table: string) => {
            throw new Error(`supabase.from() is deprecated. Use API routes with pool.query() for table: ${table}`);
        }
    };
}

// Default export for compatibility
export const createClient = createBrowserClient;
