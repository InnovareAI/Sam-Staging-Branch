'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase';
import AuthModal from '@/components/AuthModal';
import { Loader2 } from 'lucide-react';

// Force dynamic to prevent static generation issues
export const dynamic = 'force-dynamic';

/**
 * Login Page
 * 
 * Displays AuthModal for user authentication
 * After successful login, redirects to workspace
 */
export default function LoginPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // User is already logged in, redirect to root which will redirect to workspace
                router.push('/');
            } else {
                setChecking(false);
            }
        };

        checkAuth();
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
                    // which will trigger the checkAuth useEffect above
                }}
            />
        </div>
    );
}
