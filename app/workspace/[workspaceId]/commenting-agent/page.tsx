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
  Eye,
  UserCircle2,
  Hash,
  Building2,
  User,
  Search
} from 'lucide-react';
import CommentingCampaignModal from '@/app/components/CommentingCampaignModal';
import CommentingAgentSettings from '@/app/components/CommentingAgentSettings';

interface DashboardStats {
  total_profiles: number;
  active_profiles: number;
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

interface Monitor {
  id: string;
  name: string;
  hashtags: string[];
  keywords: string[];
  status: 'active' | 'paused' | 'draft';
  created_at: string;
  posts_count?: number;
}

interface MonitorsByType {
  keywords: Monitor[];
  profiles: Monitor[];
  companies: Monitor[];
  myProfile: Monitor[];
  myCompanies: Monitor[];
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
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [monitorsByType, setMonitorsByType] = useState<MonitorsByType>({
    keywords: [],
    profiles: [],
    companies: [],
    myProfile: [],
    myCompanies: []
  });

  useEffect(() => {
    loadDashboardData();
  }, [workspaceId]);

  // Categorize monitors by type based on hashtags array content
  const categorizeMonitors = (monitors: Monitor[]): MonitorsByType => {
    const result: MonitorsByType = {
      keywords: [],
      profiles: [],
      companies: [],
      myProfile: [],
      myCompanies: []
    };

    monitors.forEach(monitor => {
      // Check hashtags array for type prefixes
      const hasKeywordPrefix = monitor.hashtags?.some(h => h.startsWith('KEYWORD:'));
      const hasHashtagPrefix = monitor.hashtags?.some(h => h.startsWith('HASHTAG:') || h.startsWith('#'));
      const hasProfilePrefix = monitor.hashtags?.some(h => h.startsWith('PROFILE:'));
      const hasCompanyPrefix = monitor.hashtags?.some(h => h.startsWith('COMPANY:'));
      const isMyProfile = monitor.hashtags?.some(h => h.startsWith('MY_PROFILE:'));
      const isMyCompany = monitor.hashtags?.some(h => h.startsWith('MY_COMPANY:'));
      const hasKeywordsArray = monitor.keywords && monitor.keywords.length > 0;

      if (isMyProfile) {
        result.myProfile.push(monitor);
      } else if (isMyCompany) {
        result.myCompanies.push(monitor);
      } else if (hasCompanyPrefix) {
        result.companies.push(monitor);
      } else if (hasProfilePrefix) {
        result.profiles.push(monitor);
      } else if (hasKeywordPrefix || hasHashtagPrefix || hasKeywordsArray) {
        // Keywords and hashtags go to same bucket
        result.keywords.push(monitor);
      } else {
        // Default to keywords if no clear type
        result.keywords.push(monitor);
      }
    });

    return result;
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch dashboard stats, activity, settings, and monitors
      const [statsRes, activityRes, settingsRes, monitorsRes] = await Promise.all([
        fetch(`/api/linkedin-commenting/stats?workspace_id=${workspaceId}`),
        fetch(`/api/linkedin-commenting/recent-activity?workspace_id=${workspaceId}&limit=5`),
        fetch(`/api/linkedin-commenting/settings?workspace_id=${workspaceId}`),
        fetch(`/api/linkedin-commenting/monitors?workspace_id=${workspaceId}`)
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

      if (monitorsRes.ok) {
        const data = await monitorsRes.json();
        const fetchedMonitors = data.monitors || [];
        setMonitors(fetchedMonitors);
        setMonitorsByType(categorizeMonitors(fetchedMonitors));
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
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
        variant === 'primary'
          ? 'bg-pink-600 hover:bg-pink-700 text-white'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  // Monitor Section Card Component
  const MonitorSection = ({
    title,
    description,
    icon: Icon,
    monitors,
    color,
    onAdd,
    emptyText
  }: {
    title: string;
    description: string;
    icon: any;
    monitors: Monitor[];
    color: string;
    onAdd: () => void;
    emptyText: string;
  }) => {
    const activeCount = monitors.filter(m => m.status === 'active').length;

    return (
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
                <Icon size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">{title}</h3>
                <p className="text-gray-400 text-sm">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">{activeCount} active</span>
              <button
                onClick={onAdd}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title={`Add ${title}`}
              >
                <Plus size={16} className="text-gray-300" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4">
          {monitors.length === 0 ? (
            <div className="text-center py-6">
              <Icon size={32} className="mx-auto text-gray-600 mb-2" />
              <p className="text-gray-500 text-sm">{emptyText}</p>
              <button
                onClick={onAdd}
                className="mt-3 text-pink-400 hover:text-pink-300 text-sm transition-colors"
              >
                + Add your first one
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {monitors.map((monitor) => (
                <div
                  key={monitor.id}
                  onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/monitor/${monitor.id}`)}
                  className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${monitor.status === 'active' ? 'bg-green-400' : 'bg-gray-500'}`} />
                    <span className="text-white text-sm truncate group-hover:text-pink-400 transition-colors">
                      {monitor.name || 'Unnamed Monitor'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{monitor.posts_count || 0} posts</span>
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

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
      <div className="flex items-center justify-between mb-6">
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
            label="Add Profile"
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
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-yellow-600 hover:bg-yellow-700 text-white transition-colors"
          >
            Enable Agent
          </button>
        </div>
      )}

      {/* Section 1: Pending Approvals - Full Width Banner */}
      <div
        onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/approve`)}
        className="mb-6 bg-gradient-to-r from-amber-900/40 to-orange-900/40 rounded-xl p-5 border border-amber-700/50 cursor-pointer hover:border-amber-600 transition-colors group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-600 rounded-xl flex items-center justify-center">
              <Clock size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Pending Approvals
                {(stats?.pending_comments || 0) > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-sm rounded-full animate-pulse">
                    {stats?.pending_comments}
                  </span>
                )}
              </h2>
              <p className="text-amber-200/70">Review AI-generated comments before posting</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-2xl font-bold text-white">{stats?.pending_comments || 0}</p>
              <p className="text-amber-200/70 text-sm">awaiting review</p>
            </div>
            <ExternalLink size={20} className="text-amber-400 group-hover:text-amber-300 transition-colors" />
          </div>
        </div>
      </div>

      {/* Section Header: Comment on Others' Posts */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Target size={20} className="text-pink-500" />
          Comment on Others' Posts
        </h2>
        <p className="text-gray-400 text-sm">Monitor profiles, companies & keywords to engage with their content</p>
      </div>

      {/* Sections 2-4: Monitored Keywords, Profiles, Companies */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <MonitorSection
          title="Monitored Keywords"
          description="Track hashtags & keywords"
          icon={Hash}
          monitors={monitorsByType.keywords}
          color="bg-purple-600"
          onAdd={() => setShowCampaignModal(true)}
          emptyText="No keyword monitors yet"
        />

        <MonitorSection
          title="Monitored Profiles"
          description="Follow specific people"
          icon={User}
          monitors={monitorsByType.profiles}
          color="bg-pink-600"
          onAdd={() => setShowCampaignModal(true)}
          emptyText="No profile monitors yet"
        />

        <MonitorSection
          title="Monitored Companies"
          description="Track company pages"
          icon={Building2}
          monitors={monitorsByType.companies}
          color="bg-blue-600"
          onAdd={() => setShowCampaignModal(true)}
          emptyText="No company monitors yet"
        />
      </div>

      {/* Section Header: My Posts & Companies */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <UserCircle2 size={20} className="text-cyan-500" />
          My Posts & Companies
        </h2>
        <p className="text-gray-400 text-sm">Auto-reply to comments on your own posts and company pages</p>
      </div>

      {/* Sections 5-6: My Profile, My Companies */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <MonitorSection
          title="My Profile"
          description="Auto-reply to your post comments"
          icon={UserCircle2}
          monitors={monitorsByType.myProfile}
          color="bg-cyan-600"
          onAdd={() => router.push(`/workspace/${workspaceId}/commenting-agent/my-posts`)}
          emptyText="No personal post monitors yet"
        />

        <MonitorSection
          title="My Companies"
          description="Manage your company page comments"
          icon={Building2}
          monitors={monitorsByType.myCompanies}
          color="bg-teal-600"
          onAdd={() => router.push(`/workspace/${workspaceId}/commenting-agent/my-posts`)}
          emptyText="No company page monitors yet"
        />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Target}
          label="Active Monitors"
          value={monitors.filter(m => m.status === 'active').length}
          subtext={`${monitors.length} total`}
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
          icon={BarChart3}
          label="Engagement Rate"
          value={`${stats?.engagement_rate || 0}%`}
          subtext="Average across monitors"
          color="bg-blue-600"
        />
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
