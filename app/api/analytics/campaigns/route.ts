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

    // Generate time series if the RPC function doesn't exist
    let campaignSeries = timeSeries || [];
    if (!timeSeries || timeSeries.length === 0) {
      // Generate daily buckets for the selected range
      const days = timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : timeRange === '1m' ? 30 : 90;
      const seriesData = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = addDays(new Date(), -i);
        const dateStr = date.toISOString().split('T')[0];

        // Get messages sent on this date
        const { count: messagesCount } = await supabase
          .from('campaign_messages')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .gte('sent_at', date.toISOString().split('T')[0])
          .lt('sent_at', addDays(date, 1).toISOString().split('T')[0]);

        // Get replies received on this date
        const { count: repliesCount } = await supabase
          .from('campaign_replies')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .gte('received_at', date.toISOString().split('T')[0])
          .lt('received_at', addDays(date, 1).toISOString().split('T')[0]);

        seriesData.push({
          date: dateStr,
          prospects: 0, // TODO: Track daily prospect adds
          messages: messagesCount || 0,
          replies: repliesCount || 0,
          infoRequests: 0, // TODO: Track from campaign_replies with interested sentiment
          meetings: 0, // TODO: Track meetings booked
        });
      }

      campaignSeries = seriesData;
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
