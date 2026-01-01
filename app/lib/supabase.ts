/**
 * Supabase Compatibility Layer for Client Components
 * Migrated to Firebase Auth - Dec 31, 2025
 * 
 * This provides a Supabase-like interface that uses Firebase under the hood.
 * Components using supabase.auth.* methods will now use Firebase.
 */
'use client';

import {
  getFirebaseAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User
} from '@/lib/firebase';

// Firebase Auth wrapper that mimics Supabase auth interface
const authWrapper = {
  async getUser(): Promise<{ data: { user: { id: string; email: string | null } | null }; error: Error | null }> {
    return new Promise((resolve) => {
      const auth = getFirebaseAuth();
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        if (user) {
          resolve({
            data: { user: { id: user.uid, email: user.email } },
            error: null
          });
        } else {
          resolve({
            data: { user: null },
            error: null
          });
        }
      });
    });
  },

  async getSession(): Promise<{ data: { session: { access_token: string; user: { id: string; email: string | null } } | null }; error: Error | null }> {
    const { data } = await this.getUser();
    if (data.user) {
      const auth = getFirebaseAuth();
      const token = await auth.currentUser?.getIdToken();
      return {
        data: {
          session: {
            access_token: token || '',
            user: { id: data.user.id, email: data.user.email }
          }
        },
        error: null
      };
    }
    return { data: { session: null }, error: null };
  },

  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithEmailAndPassword(auth, email, password);
      return {
        data: {
          user: { id: result.user.uid, email: result.user.email },
          session: { access_token: await result.user.getIdToken() }
        },
        error: null
      };
    } catch (error) {
      return { data: { user: null, session: null }, error: error as Error };
    }
  },

  async signOut() {
    try {
      const auth = getFirebaseAuth();
      await firebaseSignOut(auth);
      // Clear session cookie
      await fetch('/api/auth/session', { method: 'DELETE' });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const auth = getFirebaseAuth();
    return {
      data: {
        subscription: {
          unsubscribe: onAuthStateChanged(auth, async (user) => {
            if (user) {
              const token = await user.getIdToken();
              callback('SIGNED_IN', {
                access_token: token,
                user: { id: user.uid, email: user.email }
              });
            } else {
              callback('SIGNED_OUT', null);
            }
          })
        }
      }
    };
  }
};

// Supabase-compatible client
export const supabase = {
  auth: authWrapper,
  // DB queries are no longer supported via this compat layer
  // Use pool.query() directly instead
  from: (table: string) => {
    console.warn(`⚠️ Direct Supabase DB access deprecated. Use pool.query() for table: ${table}`);
    return {
      select: () => ({ data: null, error: new Error('Supabase DB access deprecated') }),
      insert: () => ({ data: null, error: new Error('Supabase DB access deprecated') }),
      update: () => ({ data: null, error: new Error('Supabase DB access deprecated') }),
      delete: () => ({ data: null, error: new Error('Supabase DB access deprecated') }),
    };
  }
};

// For compatibility
export function createClient() {
  return supabase;
}

export default supabase;