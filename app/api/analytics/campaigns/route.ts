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
    let query = supabase
      .from('campaign_performance_summary')
      .select('*')
      .eq('workspace_id', workspaceId);

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

    // If time series function doesn't exist yet, generate simple aggregates
    const aggregatedMetrics = {
      totalProspects: 0,
      totalMessages: campaigns?.reduce((sum, c) => sum + (c.messages_sent || 0), 0) || 0,
      totalReplies: campaigns?.reduce((sum, c) => sum + (c.replies_received || 0), 0) || 0,
      totalInfoRequests: campaigns?.reduce((sum, c) => sum + (c.interested_replies || 0), 0) || 0,
      totalMeetings: campaigns?.reduce((sum, c) => sum + (c.meetings_booked || 0), 0) || 0,
    };

    // Get prospect count from campaign_prospects
    const { count: prospectCount } = await supabase
      .from('campaign_prospects')
      .select('*', { count: 'exact', head: true })
      .in('campaign_id', campaigns?.map(c => c.campaign_id) || []);

    aggregatedMetrics.totalProspects = prospectCount || 0;

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
      campaigns: campaigns || [],
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
