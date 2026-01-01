/**
 * Firebase Client Configuration
 * Provides initialized Firebase app, auth, and Firestore instances for client-side use
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | null = null;

function initializeFirebase(): FirebaseApp {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApps()[0];
    }
    return app;
}

// Get Firebase Auth instance
export function getFirebaseAuth(): Auth {
    if (!auth) {
        const firebaseApp = initializeFirebase();
        auth = getAuth(firebaseApp);
    }
    return auth;
}

// Get Firestore instance
export function getFirebaseDB(): Firestore {
    if (!db) {
        const firebaseApp = initializeFirebase();
        db = getFirestore(firebaseApp);
    }
    return db;
}

// Get Analytics instance (only on client-side)
export async function getFirebaseAnalytics(): Promise<Analytics | null> {
    if (typeof window === 'undefined') return null;

    if (!analytics) {
        const supported = await isSupported();
        if (supported) {
            const firebaseApp = initializeFirebase();
            analytics = getAnalytics(firebaseApp);
        }
    }
    return analytics;
}

// Auth providers
export const googleProvider = new GoogleAuthProvider();
export const emailProvider = new EmailAuthProvider();

// Export the app instance getter
export function getFirebaseApp(): FirebaseApp {
    return initializeFirebase();
}

// Export types for convenience
export type { FirebaseApp, Auth, Firestore, Analytics };

// Export firebase/auth methods that are commonly used
export {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile,
    updatePassword,
    type User,
    type UserCredential,
} from 'firebase/auth';

// Export firestore methods that are commonly used
export {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    type DocumentData,
    type QueryConstraint,
} from 'firebase/firestore';
