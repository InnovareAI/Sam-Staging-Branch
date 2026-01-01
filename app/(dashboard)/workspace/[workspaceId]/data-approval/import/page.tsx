'use client';

import { use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import LinkedInImportStream from '@/app/components/LinkedInImportStream';
import { createClient } from '@/app/lib/supabase';

interface PageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default function LinkedInImportPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { workspaceId } = resolvedParams;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const savedSearchUrl = searchParams.get('url');
  const targetCount = parseInt(searchParams.get('target') || '2500');
  const campaignName = searchParams.get('campaign');

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        // Verify workspace access
        const { data: member } = await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', user.id)
          .single();

        if (!member) {
          setError('You do not have access to this workspace');
          return;
        }

        setUserId(user.id);
      } catch (err) {
        console.error('Auth error:', err);
        setError('Authentication error');
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, [workspaceId, router]);

  const handleComplete = (sessionId: string, _totalProspects: number) => {
    // Navigate to data approval page with session ID
    router.push(`/workspace/${workspaceId}/data-approval?session=${sessionId}`);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold">Error</h2>
          </div>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  if (!savedSearchUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Missing LinkedIn URL</h2>
          <p className="text-gray-700 mb-6">
            A LinkedIn saved search URL is required to import prospects.
          </p>
          <button
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Workspace
          </button>
        </div>
      </div>
    );
  }

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push(`/workspace/${workspaceId}`)}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Workspace
          </button>
          <h1 className="text-3xl font-semibold text-gray-900">LinkedIn Import</h1>
          <p className="text-gray-600 mt-2">
            Importing prospects from LinkedIn Sales Navigator
          </p>
        </div>

        <LinkedInImportStream
          savedSearchUrl={savedSearchUrl}
          campaignName={campaignName}
          targetCount={targetCount}
          userId={userId}
          workspaceId={workspaceId}
          onComplete={handleComplete}
          onError={handleError}
        />
      </div>
    </div>
  );
}
