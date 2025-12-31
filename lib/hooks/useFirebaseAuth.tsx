/**
 * Firebase Authentication Context Hook
 * Provides client-side auth state management with Firebase
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
    getFirebaseAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    sendPasswordResetEmail,
    type User
} from '@/lib/firebase';

interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
}

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const auth = getFirebaseAuth();

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Get ID token and sync with server
                const idToken = await firebaseUser.getIdToken();

                // Store token for API calls
                sessionStorage.setItem('firebase_token', idToken);

                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName,
                    photoURL: firebaseUser.photoURL,
                    emailVerified: firebaseUser.emailVerified,
                });

                // Sync session with server
                await fetch('/api/auth/firebase-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken }),
                });
            } else {
                sessionStorage.removeItem('firebase_token');
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signIn = async (email: string, password: string) => {
        try {
            setError(null);
            const auth = getFirebaseAuth();
            const result = await signInWithEmailAndPassword(auth, email, password);

            // Get ID token for server-side verification
            const idToken = await result.user.getIdToken();

            // Create server session
            const response = await fetch('/api/auth/firebase-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
            });

            if (!response.ok) {
                const data = await response.json();
                return { success: false, error: data.error || 'Session creation failed' };
            }

            return { success: true };
        } catch (err: any) {
            const errorMessage = getFirebaseErrorMessage(err.code);
            setError(errorMessage);
            return { success: false, error: errorMessage };
        }
    };

    const signOut = async () => {
        try {
            const auth = getFirebaseAuth();
            await firebaseSignOut(auth);

            // Clear server session
            await fetch('/api/auth/firebase-session', { method: 'DELETE' });

            sessionStorage.removeItem('firebase_token');
            setUser(null);
        } catch (err) {
            console.error('Sign out error:', err);
        }
    };

    const resetPassword = async (email: string) => {
        try {
            const auth = getFirebaseAuth();
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (err: any) {
            const errorMessage = getFirebaseErrorMessage(err.code);
            return { success: false, error: errorMessage };
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, error, signIn, signOut, resetPassword }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Map Firebase error codes to user-friendly messages
function getFirebaseErrorMessage(code: string): string {
    const errorMessages: Record<string, string> = {
        'auth/invalid-email': 'Invalid email address',
        'auth/user-disabled': 'This account has been disabled',
        'auth/user-not-found': 'No account found with this email',
        'auth/wrong-password': 'Invalid email or password',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/email-already-in-use': 'An account with this email already exists',
        'auth/weak-password': 'Password is too weak',
        'auth/network-request-failed': 'Network error. Please check your connection.',
    };

    return errorMessages[code] || 'An error occurred. Please try again.';
}
