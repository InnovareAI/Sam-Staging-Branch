'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Mail, Linkedin, MessageSquare, Users, Calendar, Target, Eye, Database, Filter, Clock } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Enhanced KPI Grid Component with real-time data
function KPIGrid({ analyticsData }: { analyticsData: any }) {
  // Calculate aggregated metrics from analytics data
  const totalMessages = analyticsData?.reduce((sum: number, item: any) => sum + (item.total_messages_sent || 0), 0) || 0;
  const totalReplies = analyticsData?.reduce((sum: number, item: any) => sum + (item.messages_with_replies || 0), 0) || 0;
  const avgResponseRate = analyticsData?.length > 0 
    ? (analyticsData.reduce((sum: number, item: any) => sum + (parseFloat(item.overall_response_rate_percent) || 0), 0) / analyticsData.length).toFixed(1)
    : '0.0';
  const recentMessages = analyticsData?.reduce((sum: number, item: any) => sum + (item.messages_last_30_days || 0), 0) || 0;

  const cards = [
    { 
      label: 'Total Messages', 
      value: totalMessages.toLocaleString(),
      icon: MessageSquare,
      color: 'text-blue-400'
    },
    { 
      label: 'Reply Rate', 
      value: `${avgResponseRate}%`,
      icon: TrendingUp,
      color: 'text-green-400'
    },
    { 
      label: 'Total Replies', 
      value: totalReplies.toLocaleString(),
      icon: Mail,
      color: 'text-purple-400'
    },
    { 
      label: 'This Month', 
      value: recentMessages.toLocaleString(),
      icon: Calendar,
      color: 'text-orange-400'
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => {
        const IconComponent = c.icon;
        return (
          <div key={c.label} className="p-6 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-750 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase text-gray-400">{c.label}</div>
              <IconComponent className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className="text-3xl font-semibold text-white">{c.value}</div>
          </div>
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

  const [viewMode, setViewMode] = useState<'overall' | 'campaign' | 'time'>('overall');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header with Mode Toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <BarChart3 className="mr-3" size={32} />
              Analytics
            </h1>
            <p className="text-gray-400">Performance metrics, insights, and optimization recommendations</p>
          </div>
        </div>
      </div>

      {/* View Mode Filters */}
      <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* View Mode Selector */}
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400" size={18} />
            <span className="text-gray-400 text-sm font-medium">View:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('overall')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'overall' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Overall
              </button>
              <button
                onClick={() => setViewMode('campaign')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'campaign' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                By Campaign
              </button>
              <button
                onClick={() => setViewMode('time')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'time' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Time Period
              </button>
            </div>
          </div>

          {/* Campaign Selector (shown when viewMode is 'campaign') */}
          {viewMode === 'campaign' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Campaign:</span>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Campaigns</option>
                <option value="q4-enterprise">Q4 Enterprise Outreach</option>
                <option value="saas-founders">SaaS Founders Series</option>
                <option value="vp-sales">VP of Sales Target List</option>
                <option value="tech-startup">Tech Startup Warmup</option>
              </select>
            </div>
          )}

          {/* Time Range Selector (shown when viewMode is 'time') */}
          {viewMode === 'time' && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Range:</span>
              <div className="flex gap-1 bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setTimeRange('7d')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    timeRange === '7d' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setTimeRange('30d')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    timeRange === '30d' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  30 Days
                </button>
                <button
                  onClick={() => setTimeRange('90d')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    timeRange === '90d' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  90 Days
                </button>
                <button
                  onClick={() => setTimeRange('all')}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    timeRange === 'all' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="mb-8">
        <KPIGrid analyticsData={analyticsData} />
      </div>

      {/* Conversion Funnel Section */}
      <div className="mb-8 bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Target className="mr-2" size={20} />
          Conversion Funnel
        </h2>
        <div className="flex items-center gap-2 mb-6">
          {/* Sent */}
          <div className="flex-1">
            <div className="bg-blue-600 h-16 rounded-lg flex items-center justify-center relative">
              <div className="text-white font-semibold">892 Sent</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">100%</div>
          </div>

          <div className="text-gray-600">→</div>

          {/* Replied */}
          <div className="flex-1" style={{ width: '48%' }}>
            <div
              className="bg-purple-600 h-16 rounded-lg flex items-center justify-center relative"
              style={{ minWidth: '100px' }}
            >
              <div className="text-white font-semibold text-sm">426 Replied</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">47.8%</div>
          </div>

          <div className="text-gray-600">→</div>

          {/* Interested */}
          <div className="flex-1" style={{ width: '28%' }}>
            <div
              className="bg-orange-600 h-16 rounded-lg flex items-center justify-center relative"
              style={{ minWidth: '90px' }}
            >
              <div className="text-white font-semibold text-sm">127 Interested</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">14.2%</div>
          </div>

          <div className="text-gray-600">→</div>

          {/* Meeting Booked */}
          <div className="flex-1" style={{ width: '14%' }}>
            <div
              className="bg-green-600 h-16 rounded-lg flex items-center justify-center relative"
              style={{ minWidth: '80px' }}
            >
              <div className="text-white font-semibold text-sm">23 Meetings</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">2.6%</div>
          </div>

          <div className="text-gray-600">→</div>

          {/* Closed */}
          <div className="flex-1" style={{ width: '5.6%' }}>
            <div
              className="bg-green-700 h-16 rounded-lg flex items-center justify-center relative"
              style={{ minWidth: '70px' }}
            >
              <div className="text-white font-semibold text-sm">5 Closed</div>
            </div>
            <div className="text-center text-sm text-gray-400 mt-2">0.56%</div>
          </div>
        </div>

        {/* Reply Quality & Time Metrics */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-700">
          <div className="bg-gray-750 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Avg Reply Time</span>
              <Clock className="text-blue-400" size={18} />
            </div>
            <div className="text-2xl font-bold text-white">4.2h</div>
            <div className="text-xs text-green-400 mt-1">↓ 15% vs last month</div>
          </div>

          <div className="bg-gray-750 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Reply Quality</span>
              <TrendingUp className="text-purple-400" size={18} />
            </div>
            <div className="text-2xl font-bold text-white">8.4/10</div>
            <div className="text-xs text-green-400 mt-1">↑ 0.3 vs last month</div>
          </div>

          <div className="bg-gray-750 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Meeting-to-Close Rate</span>
              <Target className="text-green-400" size={18} />
            </div>
            <div className="text-2xl font-bold text-white">21.7%</div>
            <div className="text-xs text-gray-400 mt-1">5 of 23 meetings</div>
          </div>
        </div>
      </div>

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

      {/* Recent Activity */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
          <Target className="mr-2" size={24} />
          Recent Activity (Last 7 Days)
        </h2>
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentActivity.slice(0, 10).map((activity, index) => (
                  <tr key={index} className="hover:bg-gray-750">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {activity.direction === 'outbound' ? (
                          <MessageSquare className="mr-2 text-blue-400" size={16} />
                        ) : (
                          <Mail className="mr-2 text-green-400" size={16} />
                        )}
                        <span className="text-sm text-white capitalize">
                          {activity.activity_type.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300 capitalize">{activity.platform}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{activity.contact_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-400">{activity.contact_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {activity.campaign_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {new Date(activity.activity_timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        activity.status === 'processed' ? 'bg-green-100 text-green-800' :
                        activity.status === 'pending_action' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {activity.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {recentActivity.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No recent activity found. Start sending messages to see analytics!
            </div>
          )}
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