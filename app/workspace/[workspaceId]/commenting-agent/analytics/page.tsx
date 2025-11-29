'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Target,
  CheckCircle2,
  Clock,
  ThumbsUp,
  Eye,
  ArrowLeft,
  Loader2,
  Calendar,
  ChevronDown
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    total_posts_discovered: number;
    total_comments_generated: number;
    total_comments_posted: number;
    total_comments_rejected: number;
    approval_rate: number;
    avg_comments_per_day: number;
  };
  trends: {
    date: string;
    posts_discovered: number;
    comments_posted: number;
  }[];
  top_monitored_profiles: {
    id: string;
    name: string;
    posts_discovered: number;
    comments_posted: number;
    approval_rate: number;
  }[];
  top_profiles: {
    profile: string;
    posts_count: number;
    comments_posted: number;
  }[];
}

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [workspaceId, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/linkedin-commenting/analytics?workspace_id=${workspaceId}&range=${timeRange}`
      );
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    icon: Icon,
    label,
    value,
    change,
    changeLabel,
    color
  }: {
    icon: any;
    label: string;
    value: string | number;
    change?: number;
    changeLabel?: string;
    color: string;
  }) => (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${
            change >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
      {changeLabel && <p className="text-xs text-gray-500 mt-1">{changeLabel}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-pink-500" />
      </div>
    );
  }

  // Mock data if API returns nothing
  const analytics = data || {
    overview: {
      total_posts_discovered: 0,
      total_comments_generated: 0,
      total_comments_posted: 0,
      total_comments_rejected: 0,
      approval_rate: 0,
      avg_comments_per_day: 0
    },
    trends: [],
    top_monitored_profiles: [],
    top_profiles: []
  };

  const maxTrendValue = Math.max(
    ...analytics.trends.map(t => Math.max(t.posts_discovered, t.comments_posted)),
    1
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent`)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="text-pink-500" />
              Commenting Analytics
            </h1>
            <p className="text-gray-400 mt-1">Track your LinkedIn engagement performance</p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="relative">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="appearance-none px-4 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Eye}
          label="Posts Discovered"
          value={analytics.overview.total_posts_discovered}
          color="bg-blue-600"
        />
        <StatCard
          icon={MessageSquare}
          label="Comments Generated"
          value={analytics.overview.total_comments_generated}
          color="bg-purple-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Comments Posted"
          value={analytics.overview.total_comments_posted}
          color="bg-green-600"
        />
        <StatCard
          icon={ThumbsUp}
          label="Approval Rate"
          value={`${analytics.overview.approval_rate}%`}
          color="bg-pink-600"
        />
      </div>

      {/* Charts Section */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Activity Trend */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Activity Trend</h2>
          {analytics.trends.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Calendar size={32} className="text-gray-600 mb-2" />
              <p className="text-gray-400">No data for this period</p>
            </div>
          ) : (
            <div className="h-48 flex items-end gap-1">
              {analytics.trends.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col gap-0.5">
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${(day.posts_discovered / maxTrendValue) * 150}px` }}
                      title={`Posts: ${day.posts_discovered}`}
                    />
                    <div
                      className="w-full bg-green-500 rounded-b"
                      style={{ height: `${(day.comments_posted / maxTrendValue) * 150}px` }}
                      title={`Comments: ${day.comments_posted}`}
                    />
                  </div>
                  {idx % 7 === 0 && (
                    <span className="text-xs text-gray-500">
                      {new Date(day.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-sm text-gray-400">Posts Discovered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-sm text-gray-400">Comments Posted</span>
            </div>
          </div>
        </div>

        {/* Performance Breakdown */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Performance Breakdown</h2>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-sm">Discovery Rate</span>
                <span className="text-white font-medium">
                  {analytics.overview.total_posts_discovered > 0
                    ? Math.round((analytics.overview.total_comments_generated / analytics.overview.total_posts_discovered) * 100)
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${analytics.overview.total_posts_discovered > 0
                      ? (analytics.overview.total_comments_generated / analytics.overview.total_posts_discovered) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-sm">Approval Rate</span>
                <span className="text-white font-medium">{analytics.overview.approval_rate}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${analytics.overview.approval_rate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 text-sm">Rejection Rate</span>
                <span className="text-white font-medium">
                  {analytics.overview.total_comments_generated > 0
                    ? Math.round((analytics.overview.total_comments_rejected / analytics.overview.total_comments_generated) * 100)
                    : 0}%
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{
                    width: `${analytics.overview.total_comments_generated > 0
                      ? (analytics.overview.total_comments_rejected / analytics.overview.total_comments_generated) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Avg. Comments/Day</span>
                <span className="text-xl font-bold text-white">
                  {analytics.overview.avg_comments_per_day.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Monitored Profiles */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Top Monitored Profiles</h2>
          {analytics.top_monitored_profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <Target size={32} className="text-gray-600 mb-2" />
              <p className="text-gray-400">No profile data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.top_monitored_profiles.map((profile, idx) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-pink-600/20 rounded-lg flex items-center justify-center text-pink-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-white font-medium truncate max-w-[200px]">{profile.name}</p>
                      <p className="text-gray-400 text-sm">
                        {profile.posts_discovered} posts, {profile.comments_posted} comments
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">{profile.approval_rate}%</p>
                    <p className="text-gray-500 text-xs">approval</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Profiles */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Most Engaged Profiles</h2>
          {analytics.top_profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <MessageSquare size={32} className="text-gray-600 mb-2" />
              <p className="text-gray-400">No profile data yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.top_profiles.map((profile, idx) => (
                <div
                  key={profile.profile}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-bold text-sm">
                      {profile.profile.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{profile.profile}</p>
                      <p className="text-gray-400 text-sm">{profile.posts_count} posts monitored</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">{profile.comments_posted}</p>
                    <p className="text-gray-500 text-xs">comments</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-8 p-5 bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-800/30">
        <h3 className="text-white font-semibold mb-3">Optimization Tips</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-gray-300">
              Aim for 80%+ approval rate by refining your brand voice settings
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-gray-300">
              Monitor 15-30 profiles for consistent daily engagement
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-gray-300">
              Post 10-20 comments per day for optimal visibility
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
