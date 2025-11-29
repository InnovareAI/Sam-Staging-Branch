'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Target,
  Plus,
  Search,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Edit,
  MessageSquare,
  Users,
  Clock,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import CommentingCampaignModal from '@/app/components/CommentingCampaignModal';

interface Monitor {
  id: string;
  name: string;
  hashtags: string[];
  keywords: string[];
  status: 'active' | 'paused' | 'draft';
  created_at: string;
  posts_discovered?: number;
  comments_generated?: number;
  comments_posted?: number;
}

export default function CampaignsListPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Monitor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Monitor | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, [workspaceId]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/linkedin-commenting/monitors?workspace_id=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.monitors || []);
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaignStatus = async (campaign: Monitor) => {
    setActionLoading(campaign.id);
    try {
      const newStatus = campaign.status === 'active' ? 'paused' : 'active';
      const response = await fetch(`/api/linkedin-commenting/monitors/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setCampaigns(prev =>
          prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c)
        );
      }
    } catch (error) {
      console.error('Failed to update campaign:', error);
    } finally {
      setActionLoading(null);
      setOpenMenuId(null);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) {
      return;
    }

    setActionLoading(campaignId);
    try {
      const response = await fetch(`/api/linkedin-commenting/monitors/${campaignId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    } finally {
      setActionLoading(null);
      setOpenMenuId(null);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.hashtags?.some(h => h.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getTargetType = (campaign: Monitor): string => {
    if (campaign.hashtags?.some(h => h.startsWith('PROFILE:'))) {
      return 'Profile';
    }
    if (campaign.keywords?.length > 0) {
      return 'Keyword';
    }
    return 'Hashtag';
  };

  const getTargetDisplay = (campaign: Monitor): string => {
    const profiles = campaign.hashtags?.filter(h => h.startsWith('PROFILE:')).map(h => h.replace('PROFILE:', ''));
    if (profiles?.length > 0) {
      return profiles.slice(0, 2).join(', ') + (profiles.length > 2 ? ` +${profiles.length - 2}` : '');
    }
    if (campaign.keywords?.length > 0) {
      return campaign.keywords.slice(0, 2).join(', ') + (campaign.keywords.length > 2 ? ` +${campaign.keywords.length - 2}` : '');
    }
    return campaign.hashtags?.slice(0, 2).join(', ') + (campaign.hashtags?.length > 2 ? ` +${campaign.hashtags.length - 2}` : '') || 'N/A';
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent`)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Commenting Campaigns</h1>
            <p className="text-gray-400 text-sm">{campaigns.length} campaigns total</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="appearance-none px-4 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Campaigns List */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
          <Target size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No campaigns found' : 'No campaigns yet'}
          </h3>
          <p className="text-gray-400 mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first campaign to start monitoring LinkedIn posts'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus size={18} />
              Create Your First Campaign
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                {/* Campaign Info */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    campaign.status === 'active' ? 'bg-green-600/20' : 'bg-gray-700'
                  }`}>
                    <Target size={24} className={campaign.status === 'active' ? 'text-green-400' : 'text-gray-500'} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-semibold truncate">{campaign.name || 'Unnamed Campaign'}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        campaign.status === 'active'
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-gray-600/20 text-gray-400'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {getTargetType(campaign)}: {getTargetDisplay(campaign)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6 mx-6">
                  <div className="text-center">
                    <p className="text-xl font-semibold text-white">{campaign.posts_discovered || 0}</p>
                    <p className="text-xs text-gray-500">Posts Found</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-semibold text-white">{campaign.comments_generated || 0}</p>
                    <p className="text-xs text-gray-500">Generated</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-semibold text-white">{campaign.comments_posted || 0}</p>
                    <p className="text-xs text-gray-500">Posted</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCampaignStatus(campaign)}
                    disabled={actionLoading === campaign.id}
                    className={`p-2 rounded-lg transition-colors ${
                      campaign.status === 'active'
                        ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-400'
                        : 'bg-green-600/20 hover:bg-green-600/30 text-green-400'
                    } disabled:opacity-50`}
                    title={campaign.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                  >
                    {actionLoading === campaign.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : campaign.status === 'active' ? (
                      <Pause size={18} />
                    ) : (
                      <Play size={18} />
                    )}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === campaign.id ? null : campaign.id)}
                      className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <MoreVertical size={18} className="text-gray-400" />
                    </button>

                    {openMenuId === campaign.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-gray-700 rounded-lg shadow-xl border border-gray-600 py-1 z-20">
                          <button
                            onClick={() => {
                              setEditingCampaign(campaign);
                              setShowCreateModal(true);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-4 py-2 text-left text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                          >
                            <Edit size={16} />
                            Edit Campaign
                          </button>
                          <button
                            onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/approve?campaign=${campaign.id}`)}
                            className="w-full px-4 py-2 text-left text-gray-200 hover:bg-gray-600 flex items-center gap-2"
                          >
                            <MessageSquare size={16} />
                            View Comments
                          </button>
                          <hr className="my-1 border-gray-600" />
                          <button
                            onClick={() => deleteCampaign(campaign.id)}
                            className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-600 flex items-center gap-2"
                          >
                            <Trash2 size={16} />
                            Delete Campaign
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Banner */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-200 font-medium">Campaign Tips</p>
            <ul className="text-blue-200/70 text-sm mt-1 space-y-1">
              <li>Monitor up to 30 profiles per campaign for best results</li>
              <li>Comments are auto-generated when new posts are discovered</li>
              <li>Review and approve comments in the Approval workflow</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showCreateModal && (
        <CommentingCampaignModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCampaign(null);
            loadCampaigns();
          }}
          workspaceId={workspaceId}
          editMode={!!editingCampaign}
          existingMonitor={editingCampaign || undefined}
        />
      )}
    </div>
  );
}
