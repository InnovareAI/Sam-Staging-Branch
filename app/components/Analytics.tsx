'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Mail, Linkedin, MessageSquare, Users, Calendar, Target } from 'lucide-react';

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

  // Generate realistic dummy data for demo purposes
  useEffect(() => {
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

    generateDummyData();
  }, []);

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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
          <BarChart3 className="mr-3" size={32} />
          Analytics
        </h1>
        <p className="text-gray-400">Performance metrics, insights, and optimization recommendations</p>
      </div>

      {/* KPI Grid */}
      <div className="max-w-6xl mb-8">
        <KPIGrid analyticsData={analyticsData} />
      </div>

      {/* Platform Performance Comparison */}
      <div className="max-w-6xl mb-8">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
          <BarChart3 className="mr-2" size={24} />
          Platform Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {platformData.map((platform, index) => (
            <div key={platform.platform} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white capitalize flex items-center">
                  {platform.platform === 'linkedin' ? (
                    <Linkedin className="mr-2 text-blue-400" size={20} />
                  ) : (
                    <Mail className="mr-2 text-green-400" size={20} />
                  )}
                  {platform.platform}
                </h3>
                <span className={`text-sm px-2 py-1 rounded ${
                  parseFloat(platform.response_rate_percent) > 10 ? 'bg-green-100 text-green-800' : 
                  parseFloat(platform.response_rate_percent) > 5 ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-red-100 text-red-800'
                }`}>
                  {platform.response_rate_percent}% response rate
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Messages:</span>
                  <span className="text-white font-medium">{platform.total_messages?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Messages with Responses:</span>
                  <span className="text-white font-medium">{platform.messages_with_responses?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Response Time:</span>
                  <span className="text-white font-medium">
                    {platform.avg_response_time_hours ? `${Math.round(platform.avg_response_time_hours)}h` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Delivery Success:</span>
                  <span className="text-white font-medium">{platform.delivery_success_percent}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="max-w-6xl mb-8">
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
      <div className="max-w-6xl">
        <div className="bg-purple-900 border border-purple-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-100 mb-2">🎯 Demo Data Preview</h3>
          <p className="text-purple-200 text-sm">
            Currently showing realistic demo data. In production, this dashboard will display real-time analytics from your campaign messages, replies, and engagement across LinkedIn and email platforms powered by Supabase views.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;