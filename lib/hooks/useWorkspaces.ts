'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

// Types
export interface WorkspaceMember {
  id: string;
  user_id: string;
  role: string;
  workspace_id: string;
  linkedin_unipile_account_id?: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
  commenting_agent_enabled?: boolean;
  workspace_members?: WorkspaceMember[];
  pendingInvitations?: number;
  pendingList?: string[];
  company?: string;
  companyColor?: string;
}

interface WorkspaceListResponse {
  workspaces: Workspace[];
  current: Workspace | null;
  debug?: {
    userId: string;
    userEmail: string;
    isSuperAdmin: boolean;
    workspaceCount: number;
    workspaceIds: string[];
  };
}

// Local storage keys
const STORAGE_KEYS = {
  WORKSPACES: 'sam_workspaces_cache',
  CURRENT_WORKSPACE: 'selectedWorkspaceId',
  CACHE_TIMESTAMP: 'sam_workspaces_cache_ts',
} as const;

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Helper: Get auth token
async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    // Try to get from Supabase session
    const { createClient } = await import('@/app/lib/supabase');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

// Helper: Get cached workspaces from localStorage
function getCachedWorkspaces(): { workspaces: Workspace[]; currentId: string | null; timestamp: number } | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(STORAGE_KEYS.WORKSPACES);
    const timestamp = localStorage.getItem(STORAGE_KEYS.CACHE_TIMESTAMP);
    const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_WORKSPACE);

    if (!cached || !timestamp) return null;

    const parsedTimestamp = parseInt(timestamp, 10);
    const now = Date.now();

    // Check if cache is still valid
    if (now - parsedTimestamp > CACHE_DURATION) {
      return null;
    }

    return {
      workspaces: JSON.parse(cached),
      currentId,
      timestamp: parsedTimestamp,
    };
  } catch {
    return null;
  }
}

// Helper: Save workspaces to localStorage
function cacheWorkspaces(workspaces: Workspace[], currentId: string | null): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(workspaces));
    localStorage.setItem(STORAGE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
    if (currentId) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_WORKSPACE, currentId);
    }
  } catch (e) {
    console.warn('Failed to cache workspaces:', e);
  }
}

// Helper: Clear workspace cache
export function clearWorkspaceCache(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.WORKSPACES);
  localStorage.removeItem(STORAGE_KEYS.CACHE_TIMESTAMP);
}

// Fetch workspaces from API
async function fetchWorkspaces(accessToken?: string): Promise<WorkspaceListResponse> {
  const token = accessToken || await getAuthToken();

  const response = await fetch('/api/workspace/list', {
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workspaces: ${response.status}`);
  }

  const data = await response.json();

  // Enrich workspaces with company info
  const enrichedWorkspaces = (data.workspaces || []).map((ws: Workspace) => {
    let company = 'InnovareAI';
    let companyColor = 'bg-blue-600';

    if (ws.name.toLowerCase().includes('3cubed') ||
        ws.name === '3cubed' ||
        ws.name.toLowerCase().includes('sendingcell') ||
        ws.name.toLowerCase().includes('wt') ||
        ws.name.toLowerCase().includes('matchmaker')) {
      company = '3cubed';
      companyColor = 'bg-orange-600';
    }

    return {
      ...ws,
      company,
      companyColor,
      pendingInvitations: 0, // Will be fetched separately if needed
      pendingList: [],
    };
  });

  return {
    ...data,
    workspaces: enrichedWorkspaces,
  };
}

// Set current workspace API call
async function setCurrentWorkspace(workspaceId: string): Promise<void> {
  const token = await getAuthToken();

  await fetch('/api/workspace/set-current', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ workspaceId }),
  });
}

/**
 * useWorkspaces - React Query hook for workspace data with localStorage persistence
 *
 * Features:
 * - Instant loading from localStorage cache
 * - Background refresh from API
 * - Optimistic updates when switching workspaces
 * - 5-minute cache duration
 */
export function useWorkspaces(accessToken?: string) {
  const queryClient = useQueryClient();

  // Get initial data from cache for instant loading
  const cachedData = getCachedWorkspaces();

  const query = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => fetchWorkspaces(accessToken),
    // Use cached data as initial data for instant loading
    initialData: cachedData ? {
      workspaces: cachedData.workspaces,
      current: cachedData.workspaces.find(w => w.id === cachedData.currentId) || null,
    } : undefined,
    // Consider data stale after 1 minute (will refetch in background)
    staleTime: 60 * 1000,
    // Keep in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
    // Refetch on mount if data is stale
    refetchOnMount: 'always',
    // Don't refetch on window focus (annoying for users)
    refetchOnWindowFocus: false,
  });

  // Cache workspaces to localStorage when data changes
  useEffect(() => {
    if (query.data?.workspaces && query.data.workspaces.length > 0) {
      cacheWorkspaces(
        query.data.workspaces,
        query.data.current?.id || null
      );
    }
  }, [query.data]);

  // Mutation to switch workspace
  const switchWorkspaceMutation = useMutation({
    mutationFn: setCurrentWorkspace,
    onMutate: async (newWorkspaceId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['workspaces'] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<WorkspaceListResponse>(['workspaces']);

      // Optimistically update
      if (previousData) {
        const newCurrent = previousData.workspaces.find(w => w.id === newWorkspaceId);
        queryClient.setQueryData<WorkspaceListResponse>(['workspaces'], {
          ...previousData,
          current: newCurrent || null,
        });

        // Update localStorage immediately
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.CURRENT_WORKSPACE, newWorkspaceId);
        }
      }

      return { previousData };
    },
    onError: (_err, _newWorkspaceId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['workspaces'], context.previousData);
      }
    },
    onSettled: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-connection'] });
    },
  });

  // Helper to switch workspace
  const switchWorkspace = useCallback((workspaceId: string) => {
    switchWorkspaceMutation.mutate(workspaceId);
  }, [switchWorkspaceMutation]);

  // Helper to force refresh
  const refresh = useCallback(() => {
    clearWorkspaceCache();
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  }, [queryClient]);

  return {
    workspaces: query.data?.workspaces || [],
    currentWorkspace: query.data?.current || null,
    currentWorkspaceId: query.data?.current?.id || null,
    isLoading: query.isLoading && !cachedData,
    isRefetching: query.isRefetching,
    error: query.error,
    switchWorkspace,
    refresh,
    isSwitching: switchWorkspaceMutation.isPending,
  };
}

/**
 * useLinkedInConnection - Hook for LinkedIn connection status with caching
 */
export function useLinkedInConnection(workspaceId: string | null) {
  return useQuery({
    queryKey: ['linkedin-connection', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { connected: false, accounts: [] };

      const response = await fetch('/api/unipile/accounts');
      if (!response.ok) {
        return { connected: false, accounts: [] };
      }

      const data = await response.json();
      return {
        connected: data.has_linkedin || false,
        accounts: data.accounts || [],
      };
    },
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * useCampaigns - Hook for campaigns with caching
 */
export function useCampaigns(workspaceId: string | null) {
  return useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];

      const token = await getAuthToken();
      const response = await fetch(`/api/campaigns?workspace_id=${workspaceId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }

      const result = await response.json();
      // API uses apiSuccess() wrapper
      return result.data?.campaigns || result.campaigns || [];
    },
    enabled: !!workspaceId,
    staleTime: 30 * 1000, // 30 seconds - campaigns change more frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
