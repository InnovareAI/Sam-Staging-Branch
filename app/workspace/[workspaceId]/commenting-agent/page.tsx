'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MessageSquare,
  Target,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Plus,
  Settings,
  BarChart3,
  AlertCircle,
  Loader2,
  ExternalLink,
  Eye
} from 'lucide-react';
import CommentingCampaignModal from '@/app/components/CommentingCampaignModal';
import CommentingAgentSettings from '@/app/components/CommentingAgentSettings';

interface DashboardStats {
  total_campaigns: number;
  active_campaigns: number;
  pending_comments: number;
  posted_today: number;
  posted_this_week: number;
  engagement_rate: number;
  profiles_monitored: number;
}

interface RecentActivity {
  id: string;
  type: 'posted' | 'pending' | 'discovered';
  post_author: string;
  post_snippet: string;
  comment_snippet?: string;
  timestamp: string;
}

export default function CommentingAgentDashboard() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [workspaceId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch dashboard stats
      const [statsRes, activityRes, settingsRes] = await Promise.all([
        fetch(`/api/linkedin-commenting/stats?workspace_id=${workspaceId}`),
        fetch(`/api/linkedin-commenting/recent-activity?workspace_id=${workspaceId}&limit=5`),
        fetch(`/api/linkedin-commenting/settings?workspace_id=${workspaceId}`)
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (activityRes.ok) {
        const data = await activityRes.json();
        setRecentActivity(data.activities || []);
      }

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setAgentEnabled(data.enabled || false);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, subtext, color }: {
    icon: any;
    label: string;
    value: string | number;
    subtext?: string;
    color: string;
  }) => (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );

  const QuickActionButton = ({ icon: Icon, label, onClick, variant = 'default' }: {
    icon: any;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'primary';
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
        variant === 'primary'
          ? 'bg-pink-600 hover:bg-pink-700 text-white'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="text-pink-500" />
            LinkedIn Commenting Agent
          </h1>
          <p className="text-gray-400 mt-1">
            Automate thoughtful engagement on LinkedIn posts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <QuickActionButton
            icon={Settings}
            label="Settings"
            onClick={() => setShowSettingsModal(true)}
          />
          <QuickActionButton
            icon={Plus}
            label="New Campaign"
            onClick={() => setShowCampaignModal(true)}
            variant="primary"
          />
        </div>
      </div>

      {/* Agent Status Banner */}
      {!agentEnabled && (
        <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-yellow-400" size={20} />
            <div>
              <p className="text-yellow-200 font-medium">Commenting Agent is disabled</p>
              <p className="text-yellow-200/70 text-sm">Enable it to start discovering posts and generating comments</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
          >
            Enable Agent
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={Target}
          label="Active Campaigns"
          value={stats?.active_campaigns || 0}
          subtext={`${stats?.total_campaigns || 0} total`}
          color="bg-pink-600"
        />
        <StatCard
          icon={Clock}
          label="Pending Approval"
          value={stats?.pending_comments || 0}
          subtext="Comments awaiting review"
          color="bg-amber-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Posted Today"
          value={stats?.posted_today || 0}
          subtext={`${stats?.posted_this_week || 0} this week`}
          color="bg-green-600"
        />
        <StatCard
          icon={Users}
          label="Profiles Monitored"
          value={stats?.profiles_monitored || 0}
          subtext="LinkedIn profiles"
          color="bg-blue-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/approve`)}
              className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-amber-600/20 rounded-lg flex items-center justify-center">
                  <Eye size={16} className="text-amber-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Review Comments</p>
                  <p className="text-gray-400 text-sm">{stats?.pending_comments || 0} pending</p>
                </div>
              </div>
              <ExternalLink size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
            </button>

            <button
              onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/campaigns`)}
              className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-pink-600/20 rounded-lg flex items-center justify-center">
                  <Target size={16} className="text-pink-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">Manage Campaigns</p>
                  <p className="text-gray-400 text-sm">{stats?.active_campaigns || 0} active</p>
                </div>
              </div>
              <ExternalLink size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
            </button>

            <button
              onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/analytics`)}
              className="w-full flex items-center justify-between p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <BarChart3 size={16} className="text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-white font-medium">View Analytics</p>
                  <p className="text-gray-400 text-sm">Performance metrics</p>
                </div>
              </div>
              <ExternalLink size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="md:col-span-2 bg-gray-800 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            <button
              onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/approve`)}
              className="text-sm text-pink-400 hover:text-pink-300 transition-colors"
            >
              View all
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare size={40} className="mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">No recent activity</p>
              <p className="text-gray-500 text-sm mt-1">
                Create a campaign to start discovering posts
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="p-3 bg-gray-700/50 rounded-lg border border-gray-600/50"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.type === 'posted' ? 'bg-green-600/20' :
                      activity.type === 'pending' ? 'bg-amber-600/20' : 'bg-blue-600/20'
                    }`}>
                      {activity.type === 'posted' ? (
                        <CheckCircle2 size={14} className="text-green-400" />
                      ) : activity.type === 'pending' ? (
                        <Clock size={14} className="text-amber-400" />
                      ) : (
                        <Target size={14} className="text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white font-medium truncate">{activity.post_author}</p>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm truncate">{activity.post_snippet}</p>
                      {activity.comment_snippet && (
                        <p className="text-gray-500 text-xs mt-1 truncate italic">
                          "{activity.comment_snippet}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="mt-8 bg-gradient-to-r from-pink-900/30 to-purple-900/30 rounded-xl p-6 border border-pink-800/30">
        <h2 className="text-lg font-semibold text-white mb-4">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: 1, title: 'Create Campaign', desc: 'Add LinkedIn profiles to monitor' },
            { step: 2, title: 'Discover Posts', desc: 'Agent finds new posts from profiles' },
            { step: 3, title: 'Generate Comments', desc: 'AI creates relevant, on-brand comments' },
            { step: 4, title: 'Review & Post', desc: 'Approve or edit before posting' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white font-bold">
                {item.step}
              </div>
              <p className="text-white font-medium">{item.title}</p>
              <p className="text-gray-400 text-sm mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showCampaignModal && (
        <CommentingCampaignModal
          isOpen={showCampaignModal}
          onClose={() => {
            setShowCampaignModal(false);
            loadDashboardData();
          }}
          workspaceId={workspaceId}
        />
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Commenting Agent Settings</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <CommentingAgentSettings
                workspaceId={workspaceId}
                onSaveSuccess={() => {
                  setShowSettingsModal(false);
                  loadDashboardData();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
