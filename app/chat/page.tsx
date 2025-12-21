'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase';
import { Loader2 } from 'lucide-react';

// Fallback page for /chat when middleware doesn't rewrite
// (e.g., user not authenticated or no workspace found)
export default function ChatFallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not authenticated - redirect to login
        router.push('/login?redirectTo=/chat');
      } else {
        // Authenticated but middleware didn't rewrite - try to find workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .eq('workspace_type', 'personal')
          .single();

        if (workspace) {
          router.push(`/workspace/${workspace.id}/chat`);
        }
        // No workspace found - stay on page (don't redirect to /)
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-pink-500" />
    </div>
  );
}
