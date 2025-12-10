'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MessageSquare,
  Clock,
  Plus,
  Settings,
  AlertCircle,
  Loader2,
  ExternalLink,
  Hash,
  Building2,
  User,
  UserCircle2,
  Target,
  CheckCircle2,
  BarChart3
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

  // Categorize monitors by type based on hashtags array prefixes
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
      const isMyProfile = monitor.hashtags?.some(h => h.startsWith('MY_PROFILE:'));
      const isMyCompany = monitor.hashtags?.some(h => h.startsWith('MY_COMPANY:'));
      const hasCompanyPrefix = monitor.hashtags?.some(h => h.startsWith('COMPANY:'));
      const hasProfilePrefix = monitor.hashtags?.some(h => h.startsWith('PROFILE:'));
      const hasKeywordPrefix = monitor.hashtags?.some(h => h.startsWith('KEYWORD:'));
      const hasHashtagPrefix = monitor.hashtags?.some(h => h.startsWith('HASHTAG:') || h.startsWith('#'));

      if (isMyProfile) {
        result.myProfile.push(monitor);
      } else if (isMyCompany) {
        result.myCompanies.push(monitor);
      } else if (hasCompanyPrefix) {
        result.companies.push(monitor);
      } else if (hasProfilePrefix) {
        result.profiles.push(monitor);
      } else if (hasKeywordPrefix || hasHashtagPrefix) {
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
      const [statsRes, settingsRes, monitorsRes] = await Promise.all([
        fetch(`/api/linkedin-commenting/stats?workspace_id=${workspaceId}`),
        fetch(`/api/linkedin-commenting/settings?workspace_id=${workspaceId}`),
        fetch(`/api/linkedin-commenting/monitors?workspace_id=${workspaceId}`)
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
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
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            onClick={() => setShowCampaignModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-pink-600 hover:bg-pink-700 text-white transition-colors"
          >
            <Plus size={16} />
            Add Monitor
          </button>
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

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{monitors.filter(m => m.status === 'active').length}</p>
              <p className="text-xs text-gray-400">Active Monitors</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">{monitors.length} total</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.pending_comments || 0}</p>
              <p className="text-xs text-gray-400">Pending Approval</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Awaiting review</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
              <CheckCircle2 size={16} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.posted_today || 0}</p>
              <p className="text-xs text-gray-400">Posted Today</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">{stats?.posted_this_week || 0} this week</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart3 size={16} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.engagement_rate || 0}%</p>
              <p className="text-xs text-gray-400">Engagement Rate</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">Average</p>
        </div>
      </div>

      {/* Section 1: Pending Approvals */}
      <div className="mb-8">
        <div
          onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/approve`)}
          className="bg-amber-900/30 rounded-lg p-5 border border-amber-700/50 cursor-pointer hover:border-amber-600 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-600 rounded-lg flex items-center justify-center">
                <Clock size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  1. Pending Approvals
                  {(stats?.pending_comments || 0) > 0 && (
                    <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                      {stats?.pending_comments}
                    </span>
                  )}
                </h2>
                <p className="text-amber-200/70 text-sm">Review AI-generated comments before posting</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{stats?.pending_comments || 0}</p>
                <p className="text-amber-200/70 text-xs">awaiting</p>
              </div>
              <ExternalLink size={20} className="text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Monitored Keywords */}
      <div className="mb-8">
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                <Hash size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">2. Monitored Keywords</h2>
                <p className="text-gray-400 text-sm">Track hashtags & keywords across LinkedIn</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {monitorsByType.keywords.filter(m => m.status === 'active').length} active
              </span>
              <button
                onClick={() => setShowCampaignModal(true)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Plus size={16} className="text-gray-300" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {monitorsByType.keywords.length === 0 ? (
              <div className="text-center py-8">
                <Hash size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-500 text-sm mb-2">No keyword monitors yet</p>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="text-pink-400 hover:text-pink-300 text-sm transition-colors"
                >
                  + Add your first keyword monitor
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {monitorsByType.keywords.map((monitor) => (
                  <div
                    key={monitor.id}
                    onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/monitor/${monitor.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${monitor.status === 'active' ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className="text-white text-sm">{monitor.name || 'Unnamed Monitor'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{monitor.posts_count || 0} posts</span>
                      <ExternalLink size={12} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Monitored Profiles */}
      <div className="mb-8">
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center">
                <User size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">3. Monitored Profiles</h2>
                <p className="text-gray-400 text-sm">Follow and engage with specific LinkedIn profiles</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {monitorsByType.profiles.filter(m => m.status === 'active').length} active
              </span>
              <button
                onClick={() => setShowCampaignModal(true)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Plus size={16} className="text-gray-300" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {monitorsByType.profiles.length === 0 ? (
              <div className="text-center py-8">
                <User size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-500 text-sm mb-2">No profile monitors yet</p>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="text-pink-400 hover:text-pink-300 text-sm transition-colors"
                >
                  + Add your first profile monitor
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {monitorsByType.profiles.map((monitor) => (
                  <div
                    key={monitor.id}
                    onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/monitor/${monitor.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${monitor.status === 'active' ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className="text-white text-sm">{monitor.name || 'Unnamed Monitor'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{monitor.posts_count || 0} posts</span>
                      <ExternalLink size={12} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Monitored Companies */}
      <div className="mb-8">
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">4. Monitored Companies</h2>
                <p className="text-gray-400 text-sm">Track and engage with company pages</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {monitorsByType.companies.filter(m => m.status === 'active').length} active
              </span>
              <button
                onClick={() => setShowCampaignModal(true)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Plus size={16} className="text-gray-300" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {monitorsByType.companies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-500 text-sm mb-2">No company monitors yet</p>
                <button
                  onClick={() => setShowCampaignModal(true)}
                  className="text-pink-400 hover:text-pink-300 text-sm transition-colors"
                >
                  + Add your first company monitor
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {monitorsByType.companies.map((monitor) => (
                  <div
                    key={monitor.id}
                    onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/monitor/${monitor.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${monitor.status === 'active' ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className="text-white text-sm">{monitor.name || 'Unnamed Monitor'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{monitor.posts_count || 0} posts</span>
                      <ExternalLink size={12} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 5: My Profile */}
      <div className="mb-8">
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                <UserCircle2 size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">5. My Profile</h2>
                <p className="text-gray-400 text-sm">Auto-reply to comments on your own posts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {monitorsByType.myProfile.filter(m => m.status === 'active').length} active
              </span>
              <button
                onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/my-posts`)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Plus size={16} className="text-gray-300" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {monitorsByType.myProfile.length === 0 ? (
              <div className="text-center py-8">
                <UserCircle2 size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-500 text-sm mb-2">No personal post monitors yet</p>
                <button
                  onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/my-posts`)}
                  className="text-pink-400 hover:text-pink-300 text-sm transition-colors"
                >
                  + Monitor your profile posts
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {monitorsByType.myProfile.map((monitor) => (
                  <div
                    key={monitor.id}
                    onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/monitor/${monitor.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${monitor.status === 'active' ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className="text-white text-sm">{monitor.name || 'Unnamed Monitor'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{monitor.posts_count || 0} posts</span>
                      <ExternalLink size={12} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 6: My Companies */}
      <div className="mb-8">
        <div className="bg-gray-800 rounded-lg border border-gray-700">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">6. My Companies</h2>
                <p className="text-gray-400 text-sm">Manage and respond to company page comments</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {monitorsByType.myCompanies.filter(m => m.status === 'active').length} active
              </span>
              <button
                onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/my-posts`)}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Plus size={16} className="text-gray-300" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {monitorsByType.myCompanies.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="text-gray-500 text-sm mb-2">No company page monitors yet</p>
                <button
                  onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/my-posts`)}
                  className="text-pink-400 hover:text-pink-300 text-sm transition-colors"
                >
                  + Monitor your company pages
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {monitorsByType.myCompanies.map((monitor) => (
                  <div
                    key={monitor.id}
                    onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/monitor/${monitor.id}`)}
                    className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${monitor.status === 'active' ? 'bg-green-400' : 'bg-gray-500'}`} />
                      <span className="text-white text-sm">{monitor.name || 'Unnamed Monitor'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{monitor.posts_count || 0} posts</span>
                      <ExternalLink size={12} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
