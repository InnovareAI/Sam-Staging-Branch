'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState, useEffect } from 'react'

// Hydrate React Query cache from localStorage on mount
function hydrateFromLocalStorage(queryClient: QueryClient) {
  if (typeof window === 'undefined') return;

  try {
    // Hydrate workspaces cache
    const workspacesCache = localStorage.getItem('sam_workspaces_cache');
    const workspacesCacheTs = localStorage.getItem('sam_workspaces_cache_ts');
    const currentWorkspaceId = localStorage.getItem('selectedWorkspaceId');

    if (workspacesCache && workspacesCacheTs) {
      const timestamp = parseInt(workspacesCacheTs, 10);
      const age = Date.now() - timestamp;

      // Only use cache if less than 5 minutes old
      if (age < 5 * 60 * 1000) {
        const workspaces = JSON.parse(workspacesCache);
        const current = workspaces.find((w: any) => w.id === currentWorkspaceId) || null;

        queryClient.setQueryData(['workspaces'], {
          workspaces,
          current,
        });

        console.log('✅ [Providers] Hydrated workspaces from localStorage cache');
      }
    }
  } catch (e) {
    console.warn('[Providers] Failed to hydrate from localStorage:', e);
  }
}

export function Providers({ children }: { children: ReactNode }) {
  // Create QueryClient inside component to avoid sharing across requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data stays fresh for 2 minutes (allows background refresh)
            staleTime: 2 * 60 * 1000,
            // Cache data for 30 minutes
            gcTime: 30 * 60 * 1000,
            // Refetch behavior on mount:
            // true = refetch if stale (default, uses staleTime)
            // 'always' = always refetch regardless of stale status
            // false = never refetch, only use cache
            refetchOnMount: true,
            // Don't refetch when window regains focus (causes unnecessary reloads)
            refetchOnWindowFocus: false,
            // Retry failed requests 2 times with exponential backoff
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
            // Network error handling
            networkMode: 'offlineFirst',
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,
          },
        },
      })
  )

  // Hydrate cache from localStorage on mount
  useEffect(() => {
    hydrateFromLocalStorage(queryClient);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
