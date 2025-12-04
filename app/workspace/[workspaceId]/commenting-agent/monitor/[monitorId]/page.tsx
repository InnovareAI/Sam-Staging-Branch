'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Hash,
  User,
  Building2,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Calendar,
  Send
} from 'lucide-react';

interface Post {
  id: string;
  author_name: string;
  author_headline?: string;
  post_content: string;
  share_url: string;
  post_date: string;
  status: string;
  hashtags?: string[];
  created_at: string;
  comment?: {
    id: string;
    comment_text: string;
    status: string;
    scheduled_post_time?: string;
    posted_at?: string;
  };
}

interface Monitor {
  id: string;
  name: string;
  hashtags: string[];
  status: string;
  created_at: string;
  posts_discovered?: number;
}

export default function MonitorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const monitorId = params.monitorId as string;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'discovered' | 'processing' | 'commented' | 'rejected'>('all');

  useEffect(() => {
    loadData();
  }, [monitorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch monitor details
      const monitorRes = await fetch(`/api/linkedin-commenting/monitors/${monitorId}`);
      if (monitorRes.ok) {
        const data = await monitorRes.json();
        setMonitor(data.monitor);
      }

      // Fetch posts for this monitor (all statuses)
      const postsRes = await fetch(`/api/linkedin-commenting/monitor-posts?monitor_id=${monitorId}&limit=100`);
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to load monitor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getMonitorType = (): 'hashtag' | 'profile' | 'company' => {
    const tag = monitor?.hashtags?.[0] || '';
    if (tag.startsWith('HASHTAG:')) return 'hashtag';
    if (tag.startsWith('PROFILE:')) return 'profile';
    if (tag.startsWith('COMPANY:')) return 'company';
    return 'hashtag';
  };

  const getMonitorTarget = (): string => {
    const tag = monitor?.hashtags?.[0] || '';
    if (tag.startsWith('HASHTAG:')) return `#${tag.replace('HASHTAG:', '')}`;
    if (tag.startsWith('PROFILE:')) return tag.replace('PROFILE:', '');
    if (tag.startsWith('COMPANY:')) return tag.replace('COMPANY:', '');
    return tag;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'discovered': return 'bg-blue-600/20 text-blue-400';
      case 'processing': return 'bg-amber-600/20 text-amber-400';
      case 'commented': return 'bg-green-600/20 text-green-400';
      case 'rejected': return 'bg-red-600/20 text-red-400';
      default: return 'bg-gray-600/20 text-gray-400';
    }
  };

  const getCommentStatusIcon = (status?: string) => {
    switch (status) {
      case 'posted': return <CheckCircle2 size={14} className="text-green-400" />;
      case 'scheduled': return <Clock size={14} className="text-amber-400" />;
      case 'pending_approval': return <Clock size={14} className="text-blue-400" />;
      case 'rejected': return <XCircle size={14} className="text-red-400" />;
      default: return <MessageSquare size={14} className="text-gray-500" />;
    }
  };

  const filteredPosts = posts.filter(post =>
    statusFilter === 'all' || post.status === statusFilter
  );

  const monitorType = getMonitorType();
  const MonitorIcon = monitorType === 'hashtag' ? Hash : monitorType === 'profile' ? User : Building2;
  const iconColor = monitorType === 'hashtag' ? 'bg-green-600' : monitorType === 'profile' ? 'bg-pink-600' : 'bg-blue-600';

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
            onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent/profiles`)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
          <div className={`w-12 h-12 ${iconColor} rounded-xl flex items-center justify-center`}>
            <MonitorIcon size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{monitor?.name || 'Monitor'}</h1>
            <p className="text-gray-400">
              {getMonitorTarget()} &bull; {posts.length} posts discovered
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
            monitor?.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'
          }`}>
            {monitor?.status}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Posts', value: posts.length, color: 'text-white' },
          { label: 'With Comments', value: posts.filter(p => p.comment).length, color: 'text-green-400' },
          { label: 'Posted', value: posts.filter(p => p.comment?.status === 'posted').length, color: 'text-blue-400' },
          { label: 'Scheduled', value: posts.filter(p => p.comment?.status === 'scheduled').length, color: 'text-amber-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'discovered', 'processing', 'commented', 'rejected'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-pink-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
            {filter !== 'all' && (
              <span className="ml-2 text-xs opacity-70">
                ({posts.filter(p => p.status === filter).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
          <MessageSquare size={48} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No posts found</h3>
          <p className="text-gray-400">
            {statusFilter === 'all'
              ? 'Posts will appear here when discovered'
              : `No posts with status "${statusFilter}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
            >
              {/* Post Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                      {post.author_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{post.author_name}</p>
                      {post.author_headline && (
                        <p className="text-gray-400 text-sm truncate max-w-md">{post.author_headline}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(post.status)}`}>
                      {post.status}
                    </span>
                    {post.share_url && (
                      <a
                        href={post.share_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                      >
                        <ExternalLink size={16} className="text-gray-400" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <div className="p-4">
                <p className="text-gray-300 text-sm line-clamp-3 whitespace-pre-wrap">
                  {post.post_content || 'No content available'}
                </p>
                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {post.hashtags.map((tag, i) => (
                      <span key={i} className="text-xs text-blue-400">#{tag}</span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  <Calendar size={12} className="inline mr-1" />
                  {new Date(post.post_date || post.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Comment Section */}
              {post.comment && (
                <div className="p-4 bg-gray-900/50 border-t border-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-pink-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                      {getCommentStatusIcon(post.comment.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-300">
                          {post.comment.status === 'posted' ? 'Posted Comment' :
                           post.comment.status === 'scheduled' ? 'Scheduled Comment' :
                           post.comment.status === 'pending_approval' ? 'Pending Approval' :
                           'Generated Comment'}
                        </span>
                        {post.comment.scheduled_post_time && post.comment.status === 'scheduled' && (
                          <span className="text-xs text-amber-400">
                            <Clock size={12} className="inline mr-1" />
                            {new Date(post.comment.scheduled_post_time).toLocaleString()}
                          </span>
                        )}
                        {post.comment.posted_at && (
                          <span className="text-xs text-green-400">
                            <CheckCircle2 size={12} className="inline mr-1" />
                            Posted {new Date(post.comment.posted_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">
                        {post.comment.comment_text}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* No Comment Yet */}
              {!post.comment && post.status === 'discovered' && (
                <div className="p-3 bg-gray-900/30 border-t border-gray-700 text-center">
                  <p className="text-gray-500 text-sm">
                    <Clock size={14} className="inline mr-1" />
                    Awaiting comment generation
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
