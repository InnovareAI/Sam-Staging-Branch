import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { addDays, differenceInCalendarDays } from 'date-fns';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();

    // Get user and workspace
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace_id from URL params
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');
    const timeRange = searchParams.get('time_range') || '7d';
    const campaignType = searchParams.get('campaign_type') || 'all';
    const userId = searchParams.get('user_id') || 'all';
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Calculate date range
    let dateFilter: Date;
    if (timeRange === 'custom' && startDate && endDate) {
      dateFilter = new Date(startDate);
    } else {
      const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '1m' ? 30 : 90;
      dateFilter = addDays(new Date(), -days);
    }

    // Get campaign performance summary
    // Only include active, paused, or completed campaigns (exclude drafts)
    let query = supabase
      .from('campaign_performance_summary')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['active', 'paused', 'completed']);

    if (campaignType !== 'all') {
      query = query.eq('campaign_type', campaignType);
    }

    const { data: campaigns, error: campaignsError } = await query;

    if (campaignsError) {
      console.error('Failed to fetch campaign analytics:', campaignsError);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }

    // Get time series data
    const timeSeriesQuery = supabase
      .rpc('get_campaign_time_series', {
        p_workspace_id: workspaceId,
        p_start_date: dateFilter.toISOString(),
        p_end_date: (endDate || new Date().toISOString()),
        p_campaign_type: campaignType === 'all' ? null : campaignType
      });

    const { data: timeSeries, error: timeSeriesError } = await timeSeriesQuery;

    // Get prospect counts per campaign
    const campaignIds = campaigns?.map(c => c.campaign_id) || [];
    let prospectCounts: Record<string, number> = {};

    if (campaignIds.length > 0) {
      const { data: prospectData } = await supabase
        .from('campaign_prospects')
        .select('campaign_id')
        .in('campaign_id', campaignIds);

      // Count prospects per campaign and track CR statuses
      prospectData?.forEach((p: any) => {
        prospectCounts[p.campaign_id] = (prospectCounts[p.campaign_id] || 0) + 1;
      });
    }

    // Get CR-specific metrics per campaign (for connector campaigns)
    let crMetrics: Record<string, { cr_sent: number; cr_accepted: number }> = {};

    if (campaignIds.length > 0) {
      const { data: crData } = await supabase
        .from('campaign_prospects')
        .select('campaign_id, status')
        .in('campaign_id', campaignIds)
        .in('status', ['invitation_sent', 'connected', 'message_sent', 'replied', 'interested', 'completed']);

      crData?.forEach((p: any) => {
        if (!crMetrics[p.campaign_id]) {
          crMetrics[p.campaign_id] = { cr_sent: 0, cr_accepted: 0 };
        }
        // CR Sent = all who got invitation or further
        crMetrics[p.campaign_id].cr_sent++;
        // CR Accepted = connected or beyond
        if (['connected', 'message_sent', 'replied', 'interested', 'completed'].includes(p.status)) {
          crMetrics[p.campaign_id].cr_accepted++;
        }
      });
    }

    // Get user info for campaign owners
    const creatorIds = [...new Set(campaigns?.map(c => c.created_by).filter(Boolean) || [])];
    let userInfoMap: Record<string, { full_name?: string; email?: string }> = {};

    if (creatorIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', creatorIds);

      usersData?.forEach((u: any) => {
        userInfoMap[u.id] = { full_name: u.full_name, email: u.email };
      });
    }

    // Helper to get initials from name or email
    const getInitials = (userId: string): string => {
      const user = userInfoMap[userId];
      if (user?.full_name) {
        const parts = user.full_name.trim().split(/\s+/);
        if (parts.length >= 2) {
          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
      }
      if (user?.email) {
        return user.email.split('@')[0].substring(0, 2).toUpperCase();
      }
      return '—';
    };

    // Enrich campaigns with prospect counts, owner info, and CR metrics
    const enrichedCampaigns = campaigns?.map(c => {
      const campaignCR = crMetrics[c.campaign_id] || { cr_sent: 0, cr_accepted: 0 };
      const crRate = campaignCR.cr_sent > 0
        ? Math.round((campaignCR.cr_accepted / campaignCR.cr_sent) * 100)
        : 0;

      return {
        ...c,
        prospects_count: prospectCounts[c.campaign_id] || 0,
        owner_initials: getInitials(c.created_by),
        owner_name: userInfoMap[c.created_by]?.full_name || userInfoMap[c.created_by]?.email || 'Unknown',
        // CR metrics for connector campaigns
        cr_sent: campaignCR.cr_sent,
        cr_accepted: campaignCR.cr_accepted,
        cr_rate: crRate
      };
    }) || [];

    // Calculate aggregated metrics
    const aggregatedMetrics = {
      totalProspects: Object.values(prospectCounts).reduce((sum, count) => sum + count, 0),
      totalMessages: campaigns?.reduce((sum, c) => sum + (c.messages_sent || 0), 0) || 0,
      totalReplies: campaigns?.reduce((sum, c) => sum + (c.replies_received || 0), 0) || 0,
      totalInfoRequests: campaigns?.reduce((sum, c) => sum + (c.interested_replies || 0), 0) || 0,
      totalMeetings: campaigns?.reduce((sum, c) => sum + (c.meetings_booked || 0), 0) || 0,
    };

    // Generate time series - OPTIMIZED: single query instead of N queries per day
    let campaignSeries = timeSeries || [];
    if (!timeSeries || timeSeries.length === 0) {
      const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '1m' ? 30 : 90;
      const startDateRange = addDays(new Date(), -(days - 1));
      const startDateStr = startDateRange.toISOString().split('T')[0];

      // Generate empty daily buckets
      const seriesData: Record<string, { date: string; prospects: number; messages: number; replies: number; infoRequests: number; meetings: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const date = addDays(new Date(), -i);
        const dateStr = date.toISOString().split('T')[0];
        seriesData[dateStr] = {
          date: dateStr,
          prospects: 0,
          messages: 0,
          replies: 0,
          infoRequests: 0,
          meetings: 0,
        };
      }

      // Get all campaign_prospects with status changes in date range (batch query)
      // Use campaign_prospects.updated_at for when status changed
      const campaignIds = campaigns?.map(c => c.campaign_id) || [];
      if (campaignIds.length > 0) {
        const { data: prospectsData } = await supabase
          .from('campaign_prospects')
          .select('status, updated_at')
          .in('campaign_id', campaignIds)
          .gte('updated_at', startDateStr);

        // Group by date
        prospectsData?.forEach(p => {
          if (p.updated_at) {
            const dateKey = p.updated_at.split('T')[0];
            if (seriesData[dateKey]) {
              // Count messages sent (CR sent statuses)
              if (['connection_request_sent', 'connected', 'replied', 'follow_up_sent'].includes(p.status)) {
                seriesData[dateKey].messages++;
              }
              // Count replies
              if (p.status === 'replied') {
                seriesData[dateKey].replies++;
              }
            }
          }
        });
      }

      // Convert to array sorted by date
      campaignSeries = Object.values(seriesData).sort((a, b) => a.date.localeCompare(b.date));
    }

    return NextResponse.json({
      success: true,
      campaigns: enrichedCampaigns,
      aggregatedMetrics,
      campaignSeries,
      timeRange,
    });

  } catch (error: any) {
    console.error('Analytics fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: error.message },
      { status: 500 }
    );
  }
}
