'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  MessageSquare,
  Plus,
  Settings,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  Building2,
  Link2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Edit3,
  TrendingUp,
  UserCircle2,
  ChevronRight
} from 'lucide-react';

interface SelfPostMonitor {
  id: string;
  post_url: string;
  post_social_id: string;
  post_title: string;
  post_content?: string;
  post_author_name?: string;
  is_active: boolean;
  auto_approve_replies: boolean;
  auto_connect_enabled: boolean;
  auto_connect_min_score: number;
  max_replies_per_day: number;
  total_comments_seen: number;
  total_replies_sent: number;
  replies_sent_today: number;
  reply_prompt: string;
  created_at: string;
  updated_at: string;
  replies?: Array<{
    id: string;
    commenter_name: string;
    comment_text: string;
    reply_text?: string;
    status: string;
    commenter_score?: number;
    created_at: string;
  }>;
}

interface NewMonitorForm {
  post_url: string;
  post_title: string;
  reply_prompt: string;
  reply_context: Record<string, string>;
  auto_approve_replies: boolean;
  auto_connect_enabled: boolean;
  auto_connect_min_score: number;
  max_replies_per_day: number;
}

export default function MyPostsMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  const [loading, setLoading] = useState(true);
  const [monitors, setMonitors] = useState<SelfPostMonitor[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<SelfPostMonitor | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newMonitor, setNewMonitor] = useState<NewMonitorForm>({
    post_url: '',
    post_title: '',
    reply_prompt: 'Reply in a friendly, helpful way. If they ask a question, answer it directly. Keep responses concise (1-2 sentences).',
    reply_context: {},
    auto_approve_replies: false,
    auto_connect_enabled: false,
    auto_connect_min_score: 70,
    max_replies_per_day: 20
  });

  useEffect(() => {
    loadMonitors();
  }, [workspaceId]);

  const loadMonitors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/linkedin-commenting/self-post-monitors?workspace_id=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setMonitors(data.monitors || []);
      }
    } catch (err) {
      console.error('Failed to load monitors:', err);
    } finally {
      setLoading(false);
    }
  };

  const createMonitor = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/linkedin-commenting/self-post-monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...newMonitor
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create monitor');
      }

      setShowCreateModal(false);
      setNewMonitor({
        post_url: '',
        post_title: '',
        reply_prompt: 'Reply in a friendly, helpful way. If they ask a question, answer it directly. Keep responses concise (1-2 sentences).',
        reply_context: {},
        auto_approve_replies: false,
        auto_connect_enabled: false,
        auto_connect_min_score: 70,
        max_replies_per_day: 20
      });
      loadMonitors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create monitor');
    } finally {
      setCreating(false);
    }
  };

  const toggleMonitor = async (monitorId: string, isActive: boolean) => {
    try {
      await fetch(`/api/linkedin-commenting/self-post-monitors/${monitorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });
      loadMonitors();
    } catch (err) {
      console.error('Failed to toggle monitor:', err);
    }
  };

  const deleteMonitor = async (monitorId: string) => {
    if (!confirm('Are you sure you want to delete this monitor? This will also delete all reply history.')) {
      return;
    }

    try {
      await fetch(`/api/linkedin-commenting/self-post-monitors/${monitorId}`, {
        method: 'DELETE'
      });
      loadMonitors();
    } catch (err) {
      console.error('Failed to delete monitor:', err);
    }
  };

  const StatBadge = ({ value, label, color }: { value: number; label: string; color: string }) => (
    <div className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
      {value} {label}
    </div>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <button
              onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent`)}
              className="hover:text-pink-400 transition-colors"
            >
              Commenting Agent
            </button>
            <ChevronRight size={14} />
            <span className="text-muted-foreground">My Posts</span>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <UserCircle2 className="text-pink-500" />
            Monitor My Posts
          </h1>
          <p className="text-gray-400 mt-1">
            Auto-reply to comments on your personal profile and company page posts
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-pink-600 hover:bg-pink-700 text-white transition-colors"
        >
          <Plus size={16} />
          Add Post Monitor
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-muted rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-pink-600/20 flex items-center justify-center">
              <MessageSquare size={20} className="text-pink-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{monitors.length}</p>
          <p className="text-sm text-muted-foreground">Posts Monitored</p>
        </div>
        <div className="bg-surface-muted rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {monitors.reduce((sum, m) => sum + (m.total_replies_sent || 0), 0)}
          </p>
          <p className="text-sm text-muted-foreground">Total Replies Sent</p>
        </div>
        <div className="bg-surface-muted rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Users size={20} className="text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {monitors.reduce((sum, m) => sum + (m.total_comments_seen || 0), 0)}
          </p>
          <p className="text-sm text-muted-foreground">Comments Detected</p>
        </div>
        <div className="bg-surface-muted rounded-xl p-5 border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
              <TrendingUp size={20} className="text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {monitors.filter(m => m.auto_connect_enabled).length}
          </p>
          <p className="text-sm text-muted-foreground">Lead Capture Enabled</p>
        </div>
      </div>

      {/* Monitors List */}
      {monitors.length === 0 ? (
        <div className="bg-surface-muted rounded-xl p-12 border border-border text-center">
          <UserCircle2 size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Post Monitors Yet</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Monitor your own LinkedIn posts to automatically reply to comments with personalized messages.
            Perfect for events, product launches, and thought leadership content.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm rounded-md bg-pink-600 hover:bg-pink-700 text-white transition-colors"
          >
            <Plus size={16} />
            Add Your First Post
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="bg-surface-muted rounded-xl border border-border overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {monitor.post_title || 'Untitled Post'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        monitor.is_active
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-gray-600/20 text-gray-400'
                      }`}>
                        {monitor.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>

                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                      {monitor.post_content || 'Post content not available'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <StatBadge
                        value={monitor.total_comments_seen || 0}
                        label="comments"
                        color="bg-blue-600/20 text-blue-400"
                      />
                      <StatBadge
                        value={monitor.total_replies_sent || 0}
                        label="replies"
                        color="bg-green-600/20 text-green-400"
                      />
                      <StatBadge
                        value={monitor.replies_sent_today || 0}
                        label="today"
                        color="bg-amber-600/20 text-amber-400"
                      />
                      {monitor.auto_connect_enabled && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-pink-600/20 text-pink-400">
                          Lead Capture
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={monitor.post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="View on LinkedIn"
                    >
                      <ExternalLink size={18} />
                    </a>
                    <button
                      onClick={() => {
                        setSelectedMonitor(monitor);
                        setShowEditModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="Edit"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      onClick={() => toggleMonitor(monitor.id, monitor.is_active)}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title={monitor.is_active ? 'Pause' : 'Resume'}
                    >
                      {monitor.is_active ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => deleteMonitor(monitor.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Recent Replies Preview */}
                {monitor.replies && monitor.replies.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-gray-500 mb-2">Recent Activity</p>
                    <div className="space-y-2">
                      {monitor.replies.slice(0, 2).map((reply) => (
                        <div key={reply.id} className="flex items-start gap-3 text-sm">
                          <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                            reply.status === 'posted' ? 'bg-green-500' :
                            reply.status === 'pending_approval' ? 'bg-amber-500' :
                            'bg-gray-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground">{reply.commenter_name}</span>
                            <span className="text-gray-400 mx-1">-</span>
                            <span className="text-gray-500 truncate">{reply.comment_text.substring(0, 50)}...</span>
                            {reply.commenter_score && (
                              <span className="ml-2 text-xs text-pink-400">(Score: {reply.commenter_score})</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How It Works */}
      <div className="mt-8 bg-gradient-to-r from-pink-900/30 to-purple-900/30 rounded-xl p-6 border border-pink-800/30">
        <h2 className="text-lg font-semibold text-white mb-4">How Self-Post Monitoring Works</h2>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { step: 1, title: 'Add Post URL', desc: 'Paste link to your LinkedIn post' },
            { step: 2, title: 'Set Reply Prompt', desc: 'Customize how AI responds to comments' },
            { step: 3, title: 'Auto-Detect', desc: 'Agent finds new comments every 30 min' },
            { step: 4, title: 'Reply & Capture', desc: 'Replies sent + leads scored & captured' },
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

      {/* Create Monitor Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-surface-muted rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Add Post Monitor</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-muted-foreground"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
              {error && (
                <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}

              {/* Post URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  LinkedIn Post URL *
                </label>
                <input
                  type="url"
                  value={newMonitor.post_url}
                  onChange={(e) => setNewMonitor({ ...newMonitor, post_url: e.target.value })}
                  placeholder="https://www.linkedin.com/feed/update/urn:li:activity:123..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Paste the full URL to your LinkedIn post
                </p>
              </div>

              {/* Post Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Post Title (for your reference)
                </label>
                <input
                  type="text"
                  value={newMonitor.post_title}
                  onChange={(e) => setNewMonitor({ ...newMonitor, post_title: e.target.value })}
                  placeholder="e.g., AI Event Announcement, Product Launch"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              {/* Reply Prompt */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reply Instructions *
                </label>
                <textarea
                  value={newMonitor.reply_prompt}
                  onChange={(e) => setNewMonitor({ ...newMonitor, reply_prompt: e.target.value })}
                  rows={4}
                  placeholder="Tell the AI how to respond to comments..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Example: "Reply warmly and invite them to sign up at [link]. Answer any questions about pricing or features."
                </p>
              </div>

              {/* Lead Capture Section */}
              <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                  <TrendingUp size={18} className="text-pink-400" />
                  Lead Capture (Optional)
                </h3>

                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMonitor.auto_connect_enabled}
                      onChange={(e) => setNewMonitor({ ...newMonitor, auto_connect_enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-500 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-muted-foreground">
                      Auto-send connection request to high-scoring commenters
                    </span>
                  </label>

                  {newMonitor.auto_connect_enabled && (
                    <div className="ml-7">
                      <label className="block text-sm text-gray-400 mb-1">
                        Minimum Score for Connection Request
                      </label>
                      <input
                        type="number"
                        value={newMonitor.auto_connect_min_score}
                        onChange={(e) => setNewMonitor({ ...newMonitor, auto_connect_min_score: parseInt(e.target.value) || 70 })}
                        min={0}
                        max={100}
                        className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-pink-500"
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Commenters are scored 0-100 based on job title, company, and comment quality
                      </p>
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMonitor.auto_approve_replies}
                      onChange={(e) => setNewMonitor({ ...newMonitor, auto_approve_replies: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-500 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-muted-foreground">
                      Auto-approve all generated replies (skip manual review)
                    </span>
                  </label>
                </div>
              </div>

              {/* Max Replies */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Max Replies Per Day
                </label>
                <input
                  type="number"
                  value={newMonitor.max_replies_per_day}
                  onChange={(e) => setNewMonitor({ ...newMonitor, max_replies_per_day: parseInt(e.target.value) || 20 })}
                  min={1}
                  max={100}
                  className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createMonitor}
                disabled={creating || !newMonitor.post_url || !newMonitor.reply_prompt}
                className="px-6 py-2 text-sm rounded-md bg-pink-600 hover:bg-pink-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating && <Loader2 size={16} className="animate-spin" />}
                Create Monitor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
