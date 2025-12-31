/**
 * Firebase Admin SDK Configuration
 * For server-side authentication and Firestore admin operations
 * 
 * SETUP: You need to add your service account JSON to .env.local:
 * 1. Download service account key from Firebase Console > Project Settings > Service Accounts
 * 2. Base64 encode the JSON: cat service-account.json | base64
 * 3. Add to .env.local: FIREBASE_SERVICE_ACCOUNT_KEY=<base64_encoded_json>
 * 
 * Or for development, place the JSON file in the project root as:
 * firebase-service-account.json (add to .gitignore!)
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let adminStorage: Storage | null = null;

function getServiceAccountCredential() {
    // Try environment variable first (base64 encoded JSON)
    const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (base64Key) {
        try {
            const jsonStr = Buffer.from(base64Key, 'base64').toString('utf-8');
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
        }
    }

    // Try individual environment variables (Vercel-style)
    if (
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    ) {
        return {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Handle escaped newlines in the private key
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
    }

    // Development fallback: try to load from local file
    if (process.env.NODE_ENV === 'development') {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const serviceAccount = require('../firebase-service-account.json');
            return serviceAccount;
        } catch {
            console.warn('No firebase-service-account.json found in project root');
        }
    }

    throw new Error(
        'Firebase Admin SDK credentials not configured. ' +
        'Set FIREBASE_SERVICE_ACCOUNT_KEY or individual FIREBASE_* variables.'
    );
}

function initializeFirebaseAdmin(): App {
    if (getApps().length === 0) {
        const credential = getServiceAccountCredential();
        adminApp = initializeApp({
            credential: cert(credential),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || credential.projectId,
        });
    } else {
        adminApp = getApps()[0];
    }
    return adminApp;
}

/**
 * Get Firebase Admin Auth instance for server-side authentication
 * Use for: verifying tokens, managing users, custom claims
 */
export function getAdminAuth(): Auth {
    if (!adminAuth) {
        const app = initializeFirebaseAdmin();
        adminAuth = getAuth(app);
    }
    return adminAuth;
}

/**
 * Get Firebase Admin Firestore instance for server-side database operations
 * Use for: admin operations, bypassing security rules
 */
export function getAdminFirestore(): Firestore {
    if (!adminDb) {
        const app = initializeFirebaseAdmin();
        adminDb = getFirestore(app);
    }
    return adminDb;
}

/**
 * Get Firebase Admin Storage instance for server-side file operations
 * Use for: uploading files, generating signed URLs, managing storage
 */
export function getAdminStorage(): Storage {
    if (!adminStorage) {
        const app = initializeFirebaseAdmin();
        adminStorage = getStorage(app);
    }
    return adminStorage;
}

/**
 * Get the default storage bucket
 * Bucket name comes from NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var
 */
export function getStorageBucket() {
    const storage = getAdminStorage();
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
        throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not configured');
    }
    return storage.bucket(bucketName);
}

/**
 * Verify a Firebase ID token from the client
 * @param token - Firebase ID token from client
 * @returns Decoded token with user info, or null if invalid
 */
export async function verifyIdToken(token: string) {
    try {
        const auth = getAdminAuth();
        return await auth.verifyIdToken(token);
    } catch (error) {
        console.error('Token verification failed:', error);
        return null;
    }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
    try {
        const auth = getAdminAuth();
        return await auth.getUserByEmail(email);
    } catch {
        return null;
    }
}

/**
 * Set custom claims on a user (e.g., admin role)
 */
export async function setCustomClaims(uid: string, claims: Record<string, unknown>) {
    const auth = getAdminAuth();
    await auth.setCustomUserClaims(uid, claims);
}

// Export types
export type { App, Auth, Firestore, Storage };
