'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Mail, Linkedin, MessageSquare, Users, Target, Eye, Database, Filter, Clock, Activity, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { createClient } from '@/app/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format, differenceInCalendarDays, addDays } from 'date-fns';

// Campaign Analytics KPI Cards
function KPIGrid({ campaignKPIs, timeRange, campaignType, visibleMetrics }: { campaignKPIs: { totalProspects: number; totalMessages: number; totalReplies: number; totalInfoRequests: number; totalMeetings: number }, timeRange: '1d' | '7d' | '1m' | '3m' | 'custom', campaignType: string, visibleMetrics: Array<'prospects'|'messages'|'replies'|'infoRequests'|'meetings'> }) {
  // Use metrics from parent component
  const totalProspects = campaignKPIs.totalProspects;
  const totalMessages = campaignKPIs.totalMessages;
  const totalReplies = campaignKPIs.totalReplies;
  const totalInfoRequests = campaignKPIs.totalInfoRequests;
  const totalMeetings = campaignKPIs.totalMeetings;

  // Dynamic label for second card based on campaign type
  const getMessagesLabel = () => {
    switch (campaignType) {
      case 'connector':
        return 'Connection Requests Sent';
      case 'messenger':
      case 'group':
        return 'Direct Messages Sent';
      case 'email':
        return 'Emails Sent';
      default:
        return 'Total Messages Sent';
    }
  };

  const cards = [
    {
      key: 'prospects',
      label: 'Total Prospects',
      value: totalProspects.toLocaleString(),
      sublabel: 'contacted this period',
      trend: '+12.5%',
      trendUp: true,
      icon: Users
    },
    {
      key: 'messages',
      label: getMessagesLabel(),
      value: totalMessages.toLocaleString(),
      sublabel: 'across all campaigns',
      trend: '+8.3%',
      trendUp: true,
      icon: MessageSquare
    },
    {
      key: 'replies',
      label: 'Total Replies',
      value: totalReplies.toLocaleString(),
      sublabel: totalMessages > 0 ? `${((totalReplies / totalMessages) * 100).toFixed(1)}% response rate` : 'No messages sent yet',
      trend: totalMessages > 0 ? '+5.2%' : '',
      trendUp: true,
      icon: Mail
    },
    {
      key: 'infoRequests',
      label: 'Total Info Requests',
      value: totalInfoRequests.toLocaleString(),
      sublabel: totalMessages > 0 ? `${((totalInfoRequests / totalMessages) * 100).toFixed(1)}% of messages` : 'No messages sent yet',
      trend: totalMessages > 0 ? '+3.1%' : '',
      trendUp: true,
      icon: Database
    },
    {
      key: 'meetings',
      label: 'Total Meetings Booked',
      value: totalMeetings.toLocaleString(),
      sublabel: totalMessages > 0 ? `${((totalMeetings / totalMessages) * 100).toFixed(1)}% conversion` : 'No messages sent yet',
      trend: totalMessages > 0 ? '+15.8%' : '',
      trendUp: true,
      icon: CalendarIcon
    },
  ];

  const filteredCards = cards.filter((c: any) => visibleMetrics.includes(c.key));

  return (
    <div className={`grid gap-4 ${filteredCards.length === 5 ? 'md:grid-cols-2 lg:grid-cols-5' : filteredCards.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
      {filteredCards.map(c => {
        const IconComponent = c.icon;
        return (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
              {c.trend && (
                <div className={`flex items-center text-xs font-medium ${
                  c.trendUp ? 'text-green-500' : 'text-red-500'
                }`}>
                  {c.trendUp ? '↗' : '↘'} {c.trend}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {c.sublabel}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const getVisibleMetrics = (ct: string): Array<'prospects'|'messages'|'replies'|'infoRequests'|'meetings'> => {
  switch (ct) {
    case 'connector':
      return ['prospects','messages','replies','meetings'];
    case 'messenger':
      return ['prospects','messages','replies','infoRequests'];
    case 'group':
      return ['prospects','messages','replies'];
    case 'email':
      return ['prospects','messages','replies','meetings'];
    default:
      return ['prospects','messages','replies','infoRequests','meetings'];
  }
};

interface AnalyticsProps {
  workspaceId: string | null;
}

const Analytics: React.FC<AnalyticsProps> = ({ workspaceId }) => {
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [platformData, setPlatformData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  // Use workspaceId from props - ensures data separation between workspaces
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(workspaceId);
  const [viewMode, setViewMode] = useState<'overall' | 'campaign' | 'time'>('overall');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '1m' | '3m' | 'custom'>('7d');
  const [userViewMode, setUserViewMode] = useState<'consolidated' | 'by-user'>('consolidated');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({ start: undefined, end: undefined });
  const [campaignType, setCampaignType] = useState<string>('all');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  // Campaign performance analytics
  const [campaignSeries, setCampaignSeries] = useState<{ date: string; prospects: number; messages: number; replies: number; infoRequests: number; meetings: number }[]>([]);
  const [campaignKPIs, setCampaignKPIs] = useState<{ totalProspects: number; totalMessages: number; totalReplies: number; totalInfoRequests: number; totalMeetings: number }>({ totalProspects: 0, totalMessages: 0, totalReplies: 0, totalInfoRequests: 0, totalMeetings: 0 });
  const [campaignsData, setCampaignsData] = useState<any[]>([]);

  const supabase = createClient();

  // Sync workspace ID from props - ensures complete data separation between workspaces
  useEffect(() => {
    if (workspaceId) {
      setCurrentWorkspaceId(workspaceId);
      fetchWorkspaceMembers(workspaceId);
    } else {
      setCurrentWorkspaceId(null);
    }
  }, [workspaceId]);

  // Fetch workspace members
  const fetchWorkspaceMembers = async (workspaceId: string) => {
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select(`
          user_id,
          users:user_id (
            id,
            email,
            full_name
          )
        `)
        .eq('workspace_id', workspaceId);

      if (error) throw error;
      setWorkspaceMembers(data || []);
    } catch (error) {
      console.error('Error fetching workspace members:', error);
    }
  };

  // Load analytics data based on mode and time range
  useEffect(() => {
    if (demoMode) {
      generateDummyData();
    } else {
      fetchLiveData();
    }
  }, [demoMode, currentWorkspaceId, timeRange, customDateRange.start, customDateRange.end, campaignType]);

  // Generate realistic dummy data for demo purposes
  const generateDummyData = () => {
    setIsLoading(true);
    
    // Simulate API loading delay
    setTimeout(() => {
        // Dummy analytics data
        const dummyAnalytics = [
          { 
            total_messages_sent: 2847, 
            messages_with_replies: 486, 
            overall_response_rate_percent: '17.1',
            messages_last_30_days: 1247
          },
          { 
            total_messages_sent: 1523, 
            messages_with_replies: 201, 
            overall_response_rate_percent: '13.2',
            messages_last_30_days: 689
          }
        ];

        // Dummy platform comparison data
        const dummyPlatforms = [
          {
            platform: 'linkedin',
            total_messages: 1847,
            messages_with_responses: 312,
            response_rate_percent: '16.9',
            avg_response_time_hours: 18.5,
            delivery_success_percent: '94.2'
          },
          {
            platform: 'email',
            total_messages: 2523,
            messages_with_responses: 375,
            response_rate_percent: '14.9',
            avg_response_time_hours: 31.2,
            delivery_success_percent: '97.8'
          }
        ];

        // Dummy recent activity data
        const dummyActivity = [
          {
            activity_type: 'message_sent',
            direction: 'outbound',
            platform: 'linkedin',
            contact_name: 'Sarah Johnson',
            contact_email: 'sarah.j@techcorp.com',
            campaign_name: 'Q4 Enterprise Outreach',
            activity_timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            status: 'processed'
          },
          {
            activity_type: 'message_reply',
            direction: 'inbound',
            platform: 'email',
            contact_name: 'Mike Chen',
            contact_email: 'mike@innovate.co',
            campaign_name: 'SaaS Founders Campaign',
            activity_timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            status: 'pending_action'
          },
          {
            activity_type: 'message_sent',
            direction: 'outbound',
            platform: 'email',
            contact_name: 'Jennifer Wu',
            contact_email: 'j.wu@enterprise.com',
            campaign_name: 'Q4 Enterprise Outreach',
            activity_timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            status: 'processed'
          },
          {
            activity_type: 'message_reply',
            direction: 'inbound',
            platform: 'linkedin',
            contact_name: 'David Rodriguez',
            contact_email: 'david@startup.io',
            campaign_name: 'Startup Founders Sequence',
            activity_timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
            status: 'processed'
          },
          {
            activity_type: 'message_sent',
            direction: 'outbound',
            platform: 'linkedin',
            contact_name: 'Amanda Foster',
            contact_email: 'amanda@growth.com',
            campaign_name: 'Marketing Leaders Campaign',
            activity_timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            status: 'processed'
          }
        ];

        setAnalyticsData(dummyAnalytics);
        setPlatformData(dummyPlatforms);
        setRecentActivity(dummyActivity);

        // Dummy campaign performance series respecting selected time range
        const today = new Date();
        let points = 7;
        if (timeRange === '1d') points = 1;
        if (timeRange === '7d') points = 7;
        if (timeRange === '1m') points = 30;
        if (timeRange === '3m') points = 90;
        if (timeRange === 'custom' && customDateRange.start && customDateRange.end) {
          points = Math.max(1, differenceInCalendarDays(customDateRange.end, customDateRange.start) + 1);
        }

        const series: { date: string; prospects: number; messages: number; replies: number; infoRequests: number; meetings: number }[] = [];
        const startDate = timeRange === 'custom' && customDateRange.start && customDateRange.end
          ? new Date(customDateRange.end)
          : today;

        for (let i = points - 1; i >= 0; i--) {
          const d = addDays(startDate, -i);
          const label = d.toISOString().slice(0, 10);
          const prospects = 80 + Math.floor(Math.random() * 60);
          const messages = 100 + Math.floor(Math.random() * 80);
          const replies = Math.floor(messages * (0.4 + Math.random() * 0.15));
          const infoRequests = Math.floor(replies * (0.35 + Math.random() * 0.25));
          const meetings = Math.floor(infoRequests * (0.25 + Math.random() * 0.2));
          series.push({ date: label, prospects, messages, replies, infoRequests, meetings });
        }
        setCampaignSeries(series);
        setCampaignKPIs({
          totalProspects: series.reduce((a, b) => a + b.prospects, 0),
          totalMessages: series.reduce((a, b) => a + b.messages, 0),
          totalReplies: series.reduce((a, b) => a + b.replies, 0),
          totalInfoRequests: series.reduce((a, b) => a + b.infoRequests, 0),
          totalMeetings: series.reduce((a, b) => a + b.meetings, 0),
        });

        setIsLoading(false);
      }, 800); // Simulate 800ms loading time
  };

  // Fetch live data from database
  const fetchLiveData = async () => {
    if (!currentWorkspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams({
        workspace_id: currentWorkspaceId,
        time_range: timeRange,
        campaign_type: campaignType,
      });

      if (timeRange === 'custom' && customDateRange.start && customDateRange.end) {
        params.append('start_date', customDateRange.start.toISOString());
        params.append('end_date', customDateRange.end.toISOString());
      }

      if (userViewMode === 'by-user' && selectedUser !== 'all') {
        params.append('user_id', selectedUser);
      }

      // Fetch campaign analytics
      const response = await fetch(`/api/analytics/campaigns?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();

      if (data.success) {
        // Update campaign series for chart
        setCampaignSeries(data.campaignSeries || []);

        // Update KPIs
        setCampaignKPIs({
          totalProspects: data.aggregatedMetrics.totalProspects || 0,
          totalMessages: data.aggregatedMetrics.totalMessages || 0,
          totalReplies: data.aggregatedMetrics.totalReplies || 0,
          totalInfoRequests: data.aggregatedMetrics.totalInfoRequests || 0,
          totalMeetings: data.aggregatedMetrics.totalMeetings || 0,
        });

        // Update campaigns list for table
        setCampaignsData(data.campaigns || []);

        // TODO: Fetch platform-specific and activity data
        setAnalyticsData([]);
        setPlatformData([]);
        setRecentActivity([]);
      }

      setIsLoading(false);

    } catch (err) {
      console.error('Error fetching live data:', err);
      setError('Failed to load analytics data');
      setIsLoading(false);
    }
  };

  // Generate chart data for visualization
  const responseRateChartData = platformData.map(platform => ({
    platform: platform.platform,
    responseRate: parseFloat(platform.response_rate_percent),
    deliveryRate: parseFloat(platform.delivery_success_percent)
  }));

  const monthlyTrendData = [
    { month: 'Jul', linkedin: 1420, email: 2100 },
    { month: 'Aug', linkedin: 1847, email: 2523 },
    { month: 'Sep', linkedin: 1650, email: 2400 },
    { month: 'Oct', linkedin: 1780, email: 2650 },
    { month: 'Nov', linkedin: 1920, email: 2800 },
  ];

  const channelDistributionData = [
    { name: 'LinkedIn', value: 1847, color: '#0077B5' },
    { name: 'Email', value: 2523, color: '#EA4335' }
  ];

  // Helpers to keep table in sync with Activity Trends filters
  const getSelectedPoints = () => {
    if (timeRange === '1d') return 1;
    if (timeRange === '7d') return 7;
    if (timeRange === '1m') return 30;
    if (timeRange === '3m') return 90;
    if (timeRange === 'custom' && customDateRange.start && customDateRange.end) {
      return Math.max(1, differenceInCalendarDays(customDateRange.end, customDateRange.start) + 1);
    }
    return 7;
  };

  // Use real campaign data if available, otherwise show demo data
  const baseCampaignRows = demoMode ? [
    { name: "Q4 Enterprise Outreach", owner: "Sarah Powell", type: 'connector', prospects: 247, messages: 324, replies: 156, infoRequests: 67, meetings: 23, responseRate: 0.481 },
    { name: "SaaS Founders Series", owner: "John Smith", type: 'messenger', prospects: 189, messages: 203, replies: 89, infoRequests: 42, meetings: 18, responseRate: 0.438 },
    { name: "VP of Sales Target", owner: "Emily Chen", type: 'group', prospects: 156, messages: 178, replies: 71, infoRequests: 38, meetings: 15, responseRate: 0.399 },
    { name: "Tech Startup Warmup", owner: "Michael Brown", type: 'connector', prospects: 134, messages: 121, replies: 62, infoRequests: 29, meetings: 9, responseRate: 0.512 },
    { name: "FinTech Decision Makers", owner: "Sarah Powell", type: 'email', prospects: 121, messages: 66, replies: 48, infoRequests: 20, meetings: 6, responseRate: 0.727 },
  ] : campaignsData.map(c => ({
    name: c.campaign_name || 'Unnamed Campaign',
    owner: c.created_by || 'Unknown',
    type: c.campaign_type || 'multi_channel',
    prospects: 0, // TODO: Get from campaign_prospects count
    messages: c.messages_sent || 0,
    replies: c.replies_received || 0,
    infoRequests: c.interested_replies || 0,
    meetings: c.meetings_booked || 0,
    responseRate: c.messages_sent > 0 ? (c.replies_received / c.messages_sent) : 0,
  }));

  const dayScale = getSelectedPoints() / 7; // scale demo numbers to selected window
  const selectedUserName = workspaceMembers.find((m: any) => m.user_id === selectedUser)?.users?.full_name || workspaceMembers.find((m: any) => m.user_id === selectedUser)?.users?.email;

  const filteredCampaignRows = baseCampaignRows
    .filter(r => campaignType === 'all' ? true : r.type === campaignType)
    .filter(r => (userViewMode === 'by-user' && selectedUser !== 'all' && selectedUserName) ? r.owner === selectedUserName : true)
    .map(r => ({
      ...r,
      prospects: demoMode ? Math.max(0, Math.round(r.prospects * dayScale)) : r.prospects,
      messages: demoMode ? Math.max(0, Math.round(r.messages * dayScale)) : r.messages,
      replies: demoMode ? Math.max(0, Math.round(r.replies * dayScale)) : r.replies,
      infoRequests: demoMode ? Math.max(0, Math.round(r.infoRequests * dayScale)) : r.infoRequests,
      meetings: demoMode ? Math.max(0, Math.round(r.meetings * dayScale)) : r.meetings,
      responseRate: r.responseRate,
    }));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-lg">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-[1400px] mx-auto">
      {/* KPI Grid */}
      <div className="mb-8">
        <KPIGrid campaignKPIs={campaignKPIs} timeRange={timeRange} campaignType={campaignType} visibleMetrics={getVisibleMetrics(campaignType)} />
      </div>

      {/* Campaign Performance Overview - Time Rows & KPIs */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center text-xl">
                <Activity className="mr-2" size={20} />
                Activity Trends
              </CardTitle>
              <CardDescription>Prospects, messages, replies, info requests, and meetings over time</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-lg border border-gray-600 overflow-hidden">
                <button
                  onClick={() => {
                    setTimeRange('1d');
                    setShowCustomDatePicker(false);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-600 ${
                    timeRange === '1d' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  1 day
                </button>
                <button
                  onClick={() => {
                    setTimeRange('7d');
                    setShowCustomDatePicker(false);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-600 ${
                    timeRange === '7d' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  7 days
                </button>
                <button
                  onClick={() => {
                    setTimeRange('1m');
                    setShowCustomDatePicker(false);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-600 ${
                    timeRange === '1m' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  1 month
                </button>
                <button
                  onClick={() => {
                    setTimeRange('3m');
                    setShowCustomDatePicker(false);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-r border-gray-600 ${
                    timeRange === '3m' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  3 months
                </button>
                <button
                  onClick={() => {
                    setTimeRange('custom');
                    setShowCustomDatePicker(true);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    timeRange === 'custom' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Custom
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">Chart:</span>
                <Select value={chartType} onValueChange={(v) => setChartType(v === 'bar' ? 'bar' : 'area')}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Chart type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="area">Area</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Custom Date Picker */}
          {showCustomDatePicker && (
            <div className="mb-6 p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground block mb-2">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.start ? format(customDateRange.start, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.start}
                        onSelect={(date) => setCustomDateRange({ ...customDateRange, start: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-muted-foreground block mb-2">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customDateRange.end ? format(customDateRange.end, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customDateRange.end}
                        onSelect={(date) => setCustomDateRange({ ...customDateRange, end: date })}
                        initialFocus
                        disabled={(date) => customDateRange.start ? date < customDateRange.start : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button
                  onClick={() => {
                    // Apply custom date range logic here
                    console.log('Custom range:', customDateRange);
                  }}
                  className="mt-6"
                  disabled={!customDateRange.start || !customDateRange.end}
                >
                  Apply
                </Button>
              </div>
            </div>
          )}

          {/* Activity Trends Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={campaignSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }} labelStyle={{ color: '#F3F4F6' }} />
                    {getVisibleMetrics(campaignType).includes('prospects') && (
                      <Area type="monotone" dataKey="prospects" name="Prospects" stroke="#6366F1" fill="#6366F1" fillOpacity={0.2} strokeWidth={2} />
                    )}
                    {getVisibleMetrics(campaignType).includes('messages') && (
                      <Area type="monotone" dataKey="messages" name="Messages Sent" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} strokeWidth={2} />
                    )}
                    {getVisibleMetrics(campaignType).includes('replies') && (
                      <Area type="monotone" dataKey="replies" name="Replies" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} strokeWidth={2} />
                    )}
                    {getVisibleMetrics(campaignType).includes('infoRequests') && (
                      <Area type="monotone" dataKey="infoRequests" name="Info Requests" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} strokeWidth={2} />
                    )}
                    {getVisibleMetrics(campaignType).includes('meetings') && (
                      <Area type="monotone" dataKey="meetings" name="Meetings" stroke="#10B981" fill="#10B981" fillOpacity={0.2} strokeWidth={2} />
                    )}
                  </AreaChart>
                ) : (
                  <BarChart data={campaignSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: 6 }} labelStyle={{ color: '#F3F4F6' }} />
                    {getVisibleMetrics(campaignType).includes('prospects') && (
                      <Bar dataKey="prospects" name="Prospects" fill="#6366F1" />
                    )}
                    {getVisibleMetrics(campaignType).includes('messages') && (
                      <Bar dataKey="messages" name="Messages Sent" fill="#3B82F6" />
                    )}
                    {getVisibleMetrics(campaignType).includes('replies') && (
                      <Bar dataKey="replies" name="Replies" fill="#8B5CF6" />
                    )}
                    {getVisibleMetrics(campaignType).includes('infoRequests') && (
                      <Bar dataKey="infoRequests" name="Info Requests" fill="#F59E0B" />
                    )}
                    {getVisibleMetrics(campaignType).includes('meetings') && (
                      <Bar dataKey="meetings" name="Meetings" fill="#10B981" />
                    )}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Campaign Type Filter */}
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm font-medium">Campaign Type:</span>
            <Select value={campaignType} onValueChange={setCampaignType}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select campaign type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                <SelectItem value="connector">Connector Campaign</SelectItem>
                <SelectItem value="messenger">Messenger Campaign</SelectItem>
                <SelectItem value="group">Group Message Campaign</SelectItem>
                <SelectItem value="email">Email Campaign</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Performance Table */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-xl">
              <BarChart3 className="mr-2" size={20} />
              Campaign Performance
            </CardTitle>

            {/* Table View Filters */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">View By:</span>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as any)}
                  className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="overall">All Campaigns (Monthly)</option>
                  <option value="campaign">By Campaign</option>
                  <option value="time">By Time Period</option>
                </select>
              </div>

              {viewMode === 'campaign' && (
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Campaigns</option>
                  {campaignsData.length > 0 ? (
                    campaignsData.map((campaign) => (
                      <option key={campaign.id || campaign.campaign_name} value={campaign.campaign_name?.toLowerCase().replace(/\s+/g, '-') || ''}>
                        {campaign.campaign_name || 'Unnamed Campaign'}
                      </option>
                    ))
                  ) : demoMode ? (
                    <>
                      <option value="q4-enterprise">Q4 Enterprise Outreach</option>
                      <option value="saas-founders">SaaS Founders Series</option>
                      <option value="vp-sales">VP of Sales Target</option>
                      <option value="tech-startup">Tech Startup Warmup</option>
                    </>
                  ) : null}
                </select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Campaign Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Campaign Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Owner</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Prospects</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Messages</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Replies</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Info Requests</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Meetings</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Response Rate</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaignRows.map((campaign, index) => (
                  <tr
                    key={index}
                    className="border-b border-gray-700/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setViewMode('campaign');
                      setSelectedCampaign(campaign.name.toLowerCase().replace(/\s+/g, '-'));
                    }}
                  >
                    <td className="py-3 px-4 text-white font-medium">{campaign.name}</td>
                    <td className="py-3 px-4 text-gray-400">{campaign.owner}</td>
                    <td className="py-3 px-4 text-right text-white">{campaign.prospects.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-white">{campaign.messages.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-blue-400">{campaign.replies.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-orange-400">{campaign.infoRequests.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-green-400">{campaign.meetings.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      <Badge className="bg-purple-600/20 text-purple-400 border-purple-600">
                        {(campaign.responseRate * 100).toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources Notice - only show when there's no campaign data and not in demo mode */}
      {!demoMode && campaignsData.length === 0 && campaignKPIs.totalProspects === 0 && (
        <div>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6 text-center">
            <Database className="h-12 w-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-blue-100 mb-2">No Analytics Data Yet</h3>
            <p className="text-blue-200 text-sm mb-4">
              Start running campaigns to see real analytics data here. Once you launch campaigns, this dashboard will display live metrics from your messaging activities.
            </p>
            <button
              onClick={() => setDemoMode(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              View Demo Data
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default Analytics;