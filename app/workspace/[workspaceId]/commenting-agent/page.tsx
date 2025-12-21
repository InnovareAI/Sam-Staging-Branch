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
  BarChart3,
  ArrowRight
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
  const [activeModalTab, setActiveModalTab] = useState<'profiles' | 'companies' | 'hashtags' | 'my-content'>('profiles');
  const [myContentMode, setMyContentMode] = useState(false);
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

  const openModal = (tab: 'profiles' | 'companies' | 'hashtags' | 'my-content') => {
    setActiveModalTab(tab);
    setShowCampaignModal(true);
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

        <div
          onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/approve`)}
          className="bg-gray-800 rounded-lg p-4 border border-gray-700 cursor-pointer hover:border-amber-500 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.pending_comments || 0}</p>
              <p className="text-xs text-gray-400 group-hover:text-amber-400 transition-colors">Pending Approval</p>
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

      {/* Main Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        {/* Card 1: Personal Profiles */}
        <div
          onClick={() => openModal('profiles')}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-pink-500/50 hover:bg-gray-800/80 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-pink-600/20 rounded-xl flex items-center justify-center group-hover:bg-pink-600/30 transition-colors">
                <Target size={24} className="text-pink-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-400">
                  {monitorsByType.profiles.length} Active
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/workspace/${workspaceId}/commenting-agent/profiles`);
                  }}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <ExternalLink size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-pink-400 transition-colors">Personal Profiles</h3>
            <p className="text-gray-400 text-sm mb-4">
              Monitor and engage with specific LinkedIn user profiles. Build relationships with influencers and leads.
            </p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/workspace/${workspaceId}/commenting-agent/profiles`);
              }}
              className="text-pink-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all p-0 bg-transparent border-0"
            >
              View Campaigns <ArrowRight size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openModal('profiles');
              }}
              className="p-2 bg-pink-600/20 hover:bg-pink-600 text-pink-400 hover:text-white rounded-lg transition-colors"
              title="Add Profile"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Card 2: Company Pages */}
        <div
          onClick={() => openModal('companies')}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 hover:bg-gray-800/80 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                <Building2 size={24} className="text-blue-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-400">
                  {monitorsByType.companies.length} Active
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/workspace/${workspaceId}/commenting-agent/companies`);
                  }}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <ExternalLink size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Company Pages</h3>
            <p className="text-gray-400 text-sm mb-4">
              Track competitors or partners. Engage with company updates to increase brand visibility.
            </p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/workspace/${workspaceId}/commenting-agent/companies`);
              }}
              className="text-blue-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all p-0 bg-transparent border-0"
            >
              View Companies <ArrowRight size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openModal('companies');
              }}
              className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-colors"
              title="Add Company"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Card 3: Hashtags */}
        <div
          onClick={() => openModal('hashtags')}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 hover:bg-gray-800/80 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
                <Hash size={24} className="text-purple-500" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-400">
                  {monitorsByType.keywords.length} Active
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/workspace/${workspaceId}/commenting-agent/hashtags`);
                  }}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <ExternalLink size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">Hashtags</h3>
            <p className="text-gray-400 text-sm mb-4">
              Discover posts by topic or keyword (e.g. #SaaS, #AI). Find trends and join relevant conversations.
            </p>
          </div>
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/workspace/${workspaceId}/commenting-agent/hashtags`);
              }}
              className="text-purple-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all p-0 bg-transparent border-0"
            >
              View Hashtags <ArrowRight size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                openModal('hashtags');
              }}
              className="p-2 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white rounded-lg transition-colors"
              title="Add Hashtag"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Card 4: My Profile */}
        <div
          onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/my-posts`)}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-green-500/50 hover:bg-gray-800/80 transition-all cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
              <UserCircle2 size={24} className="text-green-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-400">
                View
              </span>
              <ExternalLink size={16} className="text-gray-500 group-hover:text-white transition-colors" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">My Profile</h3>
          <p className="text-gray-400 text-sm mb-4">
            Auto-reply to comments on your own posts. Engage with your audience and capture leads.
          </p>
          <button className="text-green-400 text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            Manage My Posts <ArrowRight size={16} />
          </button>
        </div>

      </div>

      {/* Modals */}
      {showCampaignModal && (
        <CommentingCampaignModal
          isOpen={showCampaignModal}
          onClose={() => {
            setShowCampaignModal(false);
            setMyContentMode(false);
            loadDashboardData();
          }}
          workspaceId={workspaceId}
          myContentMode={myContentMode}
          defaultTab={myContentMode ? 'my-content' : activeModalTab}
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
