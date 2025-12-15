'use client';

import { useQuery } from '@tanstack/react-query';

// Types
interface CampaignKPIs {
  totalProspects: number;
  totalMessages: number;
  totalReplies: number;
  totalInfoRequests: number;
  totalMeetings: number;
}

interface CampaignSeries {
  date: string;
  prospects: number;
  messages: number;
  replies: number;
  infoRequests: number;
  meetings: number;
}

interface AnalyticsData {
  campaigns: any[];
  campaignKPIs: CampaignKPIs;
  campaignSeries: CampaignSeries[];
  timeRange: string;
}

interface AnalyticsParams {
  workspaceId: string | null;
  timeRange: '1d' | '7d' | '1m' | '3m' | 'custom';
  campaignType: string;
  customDateRange?: { start: Date | undefined; end: Date | undefined };
  userId?: string;
}

// Fetch function
async function fetchAnalytics(params: AnalyticsParams): Promise<AnalyticsData> {
  if (!params.workspaceId) {
    throw new Error('No workspace selected');
  }

  const searchParams = new URLSearchParams({
    workspace_id: params.workspaceId,
    time_range: params.timeRange,
    campaign_type: params.campaignType,
  });

  if (params.timeRange === 'custom' && params.customDateRange?.start && params.customDateRange?.end) {
    searchParams.append('start_date', params.customDateRange.start.toISOString());
    searchParams.append('end_date', params.customDateRange.end.toISOString());
  }

  if (params.userId && params.userId !== 'all') {
    searchParams.append('user_id', params.userId);
  }

  const response = await fetch(`/api/analytics/campaigns?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch analytics');
  }

  return {
    campaigns: data.campaigns || [],
    campaignKPIs: {
      totalProspects: data.aggregatedMetrics?.totalProspects || 0,
      totalMessages: data.aggregatedMetrics?.totalMessages || 0,
      totalReplies: data.aggregatedMetrics?.totalReplies || 0,
      totalInfoRequests: data.aggregatedMetrics?.totalInfoRequests || 0,
      totalMeetings: data.aggregatedMetrics?.totalMeetings || 0,
    },
    campaignSeries: data.campaignSeries || [],
    timeRange: data.timeRange,
  };
}

/**
 * React Query hook for fetching workspace analytics
 *
 * Features:
 * - Automatic caching (5 min staleTime, 30 min gcTime from provider)
 * - No refetch on window focus (disabled in provider)
 * - Background refetch when data becomes stale
 * - Returns previous data while loading new data
 */
export function useWorkspaceAnalytics(params: AnalyticsParams) {
  // Build query key safely - avoid calling toISOString on undefined
  const startDateKey = params.customDateRange?.start ? params.customDateRange.start.toISOString() : null;
  const endDateKey = params.customDateRange?.end ? params.customDateRange.end.toISOString() : null;

  return useQuery({
    queryKey: ['analytics', params.workspaceId, params.timeRange, params.campaignType, startDateKey, endDateKey, params.userId],
    queryFn: () => fetchAnalytics(params),
    enabled: !!params.workspaceId,
    // Keep showing old data while fetching new data
    placeholderData: (previousData) => previousData,
    // Don't refetch on every mount - rely on cache
    refetchOnMount: false,
  });
}

// Default empty state for when no data is available
export const defaultAnalyticsData: AnalyticsData = {
  campaigns: [],
  campaignKPIs: {
    totalProspects: 0,
    totalMessages: 0,
    totalReplies: 0,
    totalInfoRequests: 0,
    totalMeetings: 0,
  },
  campaignSeries: [],
  timeRange: '7d',
};
