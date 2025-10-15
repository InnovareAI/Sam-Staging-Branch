'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Mail, Linkedin, MessageSquare, Users, Calendar, Target, Eye, Database, Filter, Clock, Activity, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Campaign Analytics KPI Cards
function KPIGrid({ analyticsData, timeRange }: { analyticsData: any, timeRange: '1d' | '3d' | '7d' }) {
  // Calculate metrics based on time range
  const totalProspects = 847; // TODO: Get from real data filtered by timeRange
  const totalMessages = 892; // TODO: Get from real data filtered by timeRange
  const totalReplies = 426; // TODO: Get from real data filtered by timeRange
  const totalInfoRequests = 196; // TODO: Get from real data filtered by timeRange
  const totalMeetings = 71; // TODO: Get from real data filtered by timeRange

  const cards = [
    {
      label: 'Total Prospects',
      value: totalProspects.toLocaleString(),
      sublabel: 'contacted this period',
      icon: Users
    },
    {
      label: 'Total Messages Sent',
      value: totalMessages.toLocaleString(),
      sublabel: 'across all campaigns',
      icon: MessageSquare
    },
    {
      label: 'Total Replies',
      value: totalReplies.toLocaleString(),
      sublabel: `${((totalReplies / totalMessages) * 100).toFixed(1)}% response rate`,
      icon: Mail
    },
    {
      label: 'Total Info Requests',
      value: totalInfoRequests.toLocaleString(),
      sublabel: `${((totalInfoRequests / totalMessages) * 100).toFixed(1)}% of messages`,
      icon: Database
    },
    {
      label: 'Total Meetings Booked',
      value: totalMeetings.toLocaleString(),
      sublabel: `${((totalMeetings / totalMessages) * 100).toFixed(1)}% conversion`,
      icon: Calendar
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map(c => {
        const IconComponent = c.icon;
        return (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.label}
              </CardTitle>
              <IconComponent className="h-4 w-4 text-muted-foreground" />
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

const Analytics: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [platformData, setPlatformData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overall' | 'campaign' | 'time'>('overall');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1d' | '3d' | '7d'>('7d');
  const [userViewMode, setUserViewMode] = useState<'consolidated' | 'by-user'>('consolidated');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const supabase = createClientComponentClient();

  // Get current workspace on component mount
  useEffect(() => {
    const getCurrentWorkspace = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: workspaceMember } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .single();
          
          if (workspaceMember) {
            setCurrentWorkspaceId(workspaceMember.workspace_id);
          }
        }
      } catch (error) {
        console.error('Error getting workspace:', error);
      }
    };

    getCurrentWorkspace();
  }, []);

  // Load analytics data based on mode
  useEffect(() => {
    if (demoMode) {
      generateDummyData();
    } else {
      fetchLiveData();
    }
  }, [demoMode, currentWorkspaceId]);

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
        setIsLoading(false);
      }, 800); // Simulate 800ms loading time
  };

  // Fetch live data from database
  const fetchLiveData = async () => {
    if (!currentWorkspaceId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual analytics queries when tables exist
      // For now, show empty state for live mode
      
      // Example of what the real queries would look like:
      // const { data: campaignData, error: campaignError } = await supabase
      //   .from('n8n_campaign_executions')
      //   .select('*')
      //   .eq('workspace_id', currentWorkspaceId);

      // const { data: usageData, error: usageError } = await supabase
      //   .from('workspace_usage_analytics')
      //   .select('*')
      //   .eq('workspace_id', currentWorkspaceId)
      //   .order('analytics_date', { ascending: false });

      // Temporary: Set empty data for live mode
      setAnalyticsData([]);
      setPlatformData([]);
      setRecentActivity([]);
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

  if (isLoading) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header with Mode Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <BarChart3 className="mr-3" size={32} />
              Analytics Dashboard
            </h1>
            <p className="text-gray-400">Performance metrics, insights, and optimization recommendations</p>
          </div>

          {/* User View Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="text-gray-400" size={18} />
              <span className="text-gray-400 text-sm font-medium">View:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setUserViewMode('consolidated')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    userViewMode === 'consolidated' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Consolidated
                </button>
                <button
                  onClick={() => setUserViewMode('by-user')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    userViewMode === 'by-user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  By User
                </button>
              </div>
            </div>

            {/* User Selector (shown when userViewMode is 'by-user') */}
            {userViewMode === 'by-user' && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Team Member:</span>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Users</option>
                  <option value="user1">Sarah Powell (you)</option>
                  <option value="user2">John Smith</option>
                  <option value="user3">Emily Chen</option>
                  <option value="user4">Michael Brown</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Time Period Selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm font-medium">Time Period:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeRange('1d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === '1d' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                1 Day
              </button>
              <button
                onClick={() => setTimeRange('3d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === '3d' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                3 Days
              </button>
              <button
                onClick={() => setTimeRange('7d')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === '7d' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                7 Days
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="mb-8">
        <KPIGrid analyticsData={analyticsData} timeRange={timeRange} />
      </div>

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
                  <option value="q4-enterprise">Q4 Enterprise Outreach</option>
                  <option value="saas-founders">SaaS Founders Series</option>
                  <option value="vp-sales">VP of Sales Target</option>
                  <option value="tech-startup">Tech Startup Warmup</option>
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
                {[
                  { name: "Q4 Enterprise Outreach", owner: "Sarah Powell", prospects: 247, messages: 324, replies: 156, infoRequests: 67, meetings: 23, responseRate: "48.1%" },
                  { name: "SaaS Founders Series", owner: "John Smith", prospects: 189, messages: 203, replies: 89, infoRequests: 42, meetings: 18, responseRate: "43.8%" },
                  { name: "VP of Sales Target", owner: "Emily Chen", prospects: 156, messages: 178, replies: 71, infoRequests: 38, meetings: 15, responseRate: "39.9%" },
                  { name: "Tech Startup Warmup", owner: "Michael Brown", prospects: 134, messages: 121, replies: 62, infoRequests: 29, meetings: 9, responseRate: "51.2%" },
                  { name: "FinTech Decision Makers", owner: "Sarah Powell", prospects: 121, messages: 66, replies: 48, infoRequests: 20, meetings: 6, responseRate: "72.7%" },
                ].map((campaign, index) => (
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
                        {campaign.responseRate}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <Target className="mr-2" size={20} />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
        <div className="flex items-center gap-2 mb-6">
          {/* Messages Sent */}
          <div className="flex-1">
            <div className="bg-blue-600 h-16 rounded-lg flex items-center justify-center relative">
              <div className="text-white font-semibold">892 Sent</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">100%</div>
          </div>

          <div className="text-gray-600">→</div>

          {/* CRs Accepted */}
          <div className="flex-1" style={{ width: '75%' }}>
            <div
              className="bg-indigo-600 h-16 rounded-lg flex items-center justify-center relative"
              style={{ minWidth: '100px' }}
            >
              <div className="text-white font-semibold text-sm">669 CRs Accepted</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">75%</div>
          </div>

          <div className="text-gray-600">→</div>

          {/* Replies */}
          <div className="flex-1" style={{ width: '48%' }}>
            <div
              className="bg-purple-600 h-16 rounded-lg flex items-center justify-center relative"
              style={{ minWidth: '90px' }}
            >
              <div className="text-white font-semibold text-sm">426 Replies</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">47.8%</div>
          </div>

          <div className="text-gray-600">→</div>

          {/* Info Requests */}
          <div className="flex-1" style={{ width: '22%' }}>
            <div
              className="bg-orange-600 h-16 rounded-lg flex items-center justify-center relative"
              style={{ minWidth: '90px' }}
            >
              <div className="text-white font-semibold text-sm">196 Info Requests</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">22%</div>
          </div>

          <div className="text-gray-600">→</div>

          {/* Meetings Booked */}
          <div className="flex-1" style={{ width: '8%' }}>
            <div
              className="bg-green-600 h-16 rounded-lg flex items-center justify-center relative"
              style={{ minWidth: '80px' }}
            >
              <div className="text-white font-semibold text-sm">71 Meetings</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">8%</div>
          </div>
        </div>

        {/* Reply Quality & Time Metrics */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <Card className="bg-accent/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Avg Reply Time</span>
                <Clock className="text-blue-400" size={18} />
              </div>
              <div className="text-2xl font-bold">4.2h</div>
              <div className="text-xs text-green-400 mt-1">↓ 15% vs last month</div>
            </CardContent>
          </Card>

          <Card className="bg-accent/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Reply Quality</span>
                <TrendingUp className="text-purple-400" size={18} />
              </div>
              <div className="text-2xl font-bold">8.4/10</div>
              <div className="text-xs text-green-400 mt-1">↑ 0.3 vs last month</div>
            </CardContent>
          </Card>

          <Card className="bg-accent/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm">Meeting-to-Close Rate</span>
                <Target className="text-green-400" size={18} />
              </div>
              <div className="text-2xl font-bold">21.7%</div>
              <div className="text-xs text-muted-foreground mt-1">5 of 23 meetings</div>
            </CardContent>
          </Card>
        </div>
        </CardContent>
      </Card>

      {/* Chart Views Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          <BarChart3 className="mr-2" size={24} />
          Analytics Dashboard
        </h2>
        
        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Response Rate Comparison Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Response Rate by Platform</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseRateChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="platform" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '6px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Bar dataKey="responseRate" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Monthly Message Trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '6px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Line type="monotone" dataKey="linkedin" stroke="#0077B5" strokeWidth={3} dot={{ fill: '#0077B5', strokeWidth: 0, r: 4 }} />
                  <Line type="monotone" dataKey="email" stroke="#EA4335" strokeWidth={3} dot={{ fill: '#EA4335', strokeWidth: 0, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Channel Distribution Chart */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Channel Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelDistributionData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {channelDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '6px' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Platform Performance Summary */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Platform Performance Summary</h3>
            <div className="space-y-4">
              {platformData.map((platform) => (
                <div key={platform.platform} className="border-l-4 border-purple-500 pl-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium capitalize flex items-center">
                      {platform.platform === 'linkedin' ? (
                        <Linkedin className="mr-2 text-blue-400" size={16} />
                      ) : (
                        <Mail className="mr-2 text-green-400" size={16} />
                      )}
                      {platform.platform}
                    </h4>
                    <span className="text-purple-400 text-sm font-medium">
                      {platform.response_rate_percent}% response
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {platform.total_messages?.toLocaleString()} messages • {platform.delivery_success_percent}% delivered
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources Notice */}
      {!demoMode && analyticsData.length === 0 && (
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
  );
};

export default Analytics;