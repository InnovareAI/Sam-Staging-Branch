'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth, onAuthStateChanged } from '@/lib/firebase';
import AuthModal from '@/components/AuthModal';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Login Page - Firebase Authentication
 */
export default function LoginPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const auth = getFirebaseAuth();

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // User is logged in, redirect to root which will redirect to workspace
                router.push('/');
            } else {
                setChecking(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    if (checking) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-pink-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <AuthModal
                isOpen={true}
                onClose={() => {
                    // After successful login, AuthModal reloads the page
                }}
            />
        </div>
    );
}
