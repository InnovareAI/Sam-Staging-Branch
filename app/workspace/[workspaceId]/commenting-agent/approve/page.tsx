'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  RefreshCw,
  ArrowLeft,
  Loader2,
  ThumbsUp,
  Edit3,
  Trash2,
  ExternalLink,
  ChevronDown,
  Keyboard,
  Calendar,
  Ban,
  Filter
} from 'lucide-react';

interface PendingComment {
  id: string;
  monitor_id: string;
  post_id: string;
  post_url: string;
  post_author: string;
  post_author_headline?: string;
  post_content: string;
  generated_comment: string;
  status: 'pending_approval' | 'scheduled' | 'posted' | 'rejected';
  created_at: string;
  scheduled_for?: string;
  posted_at?: string;
  rejected_at?: string;
  campaign_name?: string;
}

// Status filter options with display info
const STATUS_OPTIONS = [
  { value: 'pending_approval', label: 'Pending Approval', icon: Clock, color: 'amber' },
  { value: 'scheduled', label: 'Scheduled', icon: Calendar, color: 'blue' },
  { value: 'posted', label: 'Posted', icon: CheckCircle2, color: 'green' },
  { value: 'rejected', label: 'Rejected', icon: Ban, color: 'red' },
] as const;

type StatusFilter = typeof STATUS_OPTIONS[number]['value'];

export default function ApproveCommentsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;
  const campaignFilter = searchParams.get('campaign');

  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending_approval');
  const [dateFilter, setDateFilter] = useState<'today' | 'history'>('today');
  const [statusCounts, setStatusCounts] = useState<Record<StatusFilter, number>>({
    pending_approval: 0,
    scheduled: 0,
    posted: 0,
    rejected: 0
  });
  const [selectedComment, setSelectedComment] = useState<PendingComment | null>(null);
  const [editedComment, setEditedComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  useEffect(() => {
    loadComments();
    loadStatusCounts();
  }, [workspaceId, campaignFilter]);

  // Reload comments when status or date filter changes
  useEffect(() => {
    loadComments();
    loadStatusCounts();
  }, [statusFilter, dateFilter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedComment || isEditing) return;

      switch (e.key) {
        case 'a':
          if (statusFilter === 'pending_approval') handleApprove(selectedComment.id);
          break;
        case 'e':
          if (statusFilter === 'pending_approval') {
            setIsEditing(true);
            setEditedComment(selectedComment.generated_comment);
          }
          break;
        case 'r':
          if (statusFilter === 'pending_approval') handleReject(selectedComment.id);
          break;
        case 'ArrowUp':
          navigateComments(-1);
          break;
        case 'ArrowDown':
          navigateComments(1);
          break;
        case 'Escape':
          setSelectedComment(null);
          setShowStatusDropdown(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComment, isEditing, comments, statusFilter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowStatusDropdown(false);
    if (showStatusDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showStatusDropdown]);

  const loadStatusCounts = async () => {
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        date_filter: dateFilter
      });
      if (campaignFilter) params.append('monitor_id', campaignFilter);

      // Fetch counts for all statuses
      const countPromises = STATUS_OPTIONS.map(async (status) => {
        const res = await fetch(`/api/linkedin-commenting/comments?${params}&status=${status.value}&count_only=true`);
        if (res.ok) {
          const data = await res.json();
          return { status: status.value, count: data.count || 0 };
        }
        return { status: status.value, count: 0 };
      });

      const counts = await Promise.all(countPromises);
      const countMap = counts.reduce((acc, { status, count }) => {
        acc[status as StatusFilter] = count;
        return acc;
      }, {} as Record<StatusFilter, number>);

      setStatusCounts(countMap);
    } catch (error) {
      console.error('Failed to load status counts:', error);
    }
  };

  const loadComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        workspace_id: workspaceId,
        date_filter: dateFilter
      });
      if (campaignFilter) params.append('monitor_id', campaignFilter);

      const res = await fetch(`/api/linkedin-commenting/comments?${params}&status=${statusFilter}&limit=100`);

      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);
        if (data.comments?.length > 0 && !selectedComment) {
          setSelectedComment(data.comments[0]);
        } else if (data.comments?.length === 0) {
          setSelectedComment(null);
        }
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshComments = async () => {
    setRefreshing(true);
    await Promise.all([loadComments(), loadStatusCounts()]);
    setRefreshing(false);
  };

  const navigateComments = (direction: number) => {
    if (comments.length === 0) return;
    const currentIndex = comments.findIndex(c => c.id === selectedComment?.id);
    const newIndex = Math.max(0, Math.min(comments.length - 1, currentIndex + direction));
    setSelectedComment(comments[newIndex]);
    setIsEditing(false);
  };

  const handleApprove = async (commentId: string) => {
    setActionLoading(commentId);
    try {
      const comment = comments.find(c => c.id === commentId);
      const finalComment = isEditing && editedComment ? editedComment : comment?.generated_comment;

      const response = await fetch(`/api/linkedin-commenting/comments/${commentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: finalComment })
      });

      if (response.ok) {
        // Move to next comment
        const currentIndex = comments.findIndex(c => c.id === commentId);
        const remaining = comments.filter(c => c.id !== commentId);
        setComments(remaining);

        if (remaining.length > 0) {
          const nextIndex = Math.min(currentIndex, remaining.length - 1);
          setSelectedComment(remaining[nextIndex]);
        } else {
          setSelectedComment(null);
        }
        setIsEditing(false);
        setEditedComment('');

        // Refresh counts
        loadStatusCounts();
      }
    } catch (error) {
      console.error('Failed to approve comment:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (commentId: string) => {
    setActionLoading(commentId);
    try {
      const response = await fetch(`/api/linkedin-commenting/comments/${commentId}/reject`, {
        method: 'POST'
      });

      if (response.ok) {
        const remaining = comments.filter(c => c.id !== commentId);
        setComments(remaining);
        if (remaining.length > 0 && selectedComment?.id === commentId) {
          setSelectedComment(remaining[0]);
        } else if (remaining.length === 0) {
          setSelectedComment(null);
        }
        setIsEditing(false);
        // Refresh counts
        loadStatusCounts();
      }
    } catch (error) {
      console.error('Failed to reject comment:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerate = async (commentId: string) => {
    setActionLoading(commentId);
    try {
      const response = await fetch(`/api/linkedin-commenting/comments/${commentId}/regenerate`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev =>
          prev.map(c => c.id === commentId ? { ...c, generated_comment: data.comment } : c)
        );
        if (selectedComment?.id === commentId) {
          setSelectedComment({ ...selectedComment, generated_comment: data.comment });
          setEditedComment(data.comment);
        }
      }
    } catch (error) {
      console.error('Failed to regenerate comment:', error);
    } finally {
      setActionLoading(null);
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
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-700 bg-gray-900">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/workspace/${workspaceId}/commenting-agent`)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Comment Approval</h1>
              <p className="text-gray-400 text-sm">
                {dateFilter === 'today' ? "Today's Arrivals" : "History"} - {comments.length} items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Today/History Toggle */}
            <div className="flex p-1 bg-gray-800 rounded-lg border border-gray-700">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${dateFilter === 'today'
                  ? 'bg-pink-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('history')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${dateFilter === 'history'
                  ? 'bg-pink-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                History
              </button>
            </div>
            {/* Keyboard Shortcuts Help */}
            {statusFilter === 'pending_approval' && (
              <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 mr-4">
                <Keyboard size={14} />
                <span><kbd className="bg-gray-700 px-1 rounded">A</kbd> Approve</span>
                <span><kbd className="bg-gray-700 px-1 rounded">E</kbd> Edit</span>
                <span><kbd className="bg-gray-700 px-1 rounded">R</kbd> Reject</span>
              </div>
            )}

            <button
              onClick={refreshComments}
              disabled={refreshing}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Status Filter Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStatusDropdown(!showStatusDropdown);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
              >
                <Filter size={16} className="text-gray-400" />
                {(() => {
                  const current = STATUS_OPTIONS.find(s => s.value === statusFilter);
                  const Icon = current?.icon || Clock;
                  const colorClass = current?.color === 'amber' ? 'text-amber-400' :
                    current?.color === 'blue' ? 'text-blue-400' :
                      current?.color === 'green' ? 'text-green-400' :
                        current?.color === 'red' ? 'text-red-400' : 'text-gray-400';
                  return (
                    <>
                      <Icon size={16} className={colorClass} />
                      <span className="text-white text-sm">{current?.label}</span>
                      <span className="text-gray-400 text-sm">({statusCounts[statusFilter]})</span>
                    </>
                  );
                })()}
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showStatusDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const colorClass = option.color === 'amber' ? 'text-amber-400' :
                      option.color === 'blue' ? 'text-blue-400' :
                        option.color === 'green' ? 'text-green-400' :
                          option.color === 'red' ? 'text-red-400' : 'text-gray-400';
                    const bgHoverClass = option.color === 'amber' ? 'hover:bg-amber-900/20' :
                      option.color === 'blue' ? 'hover:bg-blue-900/20' :
                        option.color === 'green' ? 'hover:bg-green-900/20' :
                          option.color === 'red' ? 'hover:bg-red-900/20' : 'hover:bg-gray-700';
                    return (
                      <button
                        key={option.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilter(option.value);
                          setShowStatusDropdown(false);
                          setSelectedComment(null);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${bgHoverClass} ${statusFilter === option.value ? 'bg-gray-700' : ''
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={18} className={colorClass} />
                          <span className="text-white text-sm">{option.label}</span>
                        </div>
                        <span className={`text-sm font-medium ${colorClass}`}>
                          {statusCounts[option.value]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Comment List */}
        <div className="w-[400px] border-r border-gray-700 overflow-y-auto bg-gray-900">
          {comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageSquare size={48} className="text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {statusFilter === 'pending_approval' ? 'No pending comments' :
                  statusFilter === 'scheduled' ? 'No scheduled comments' :
                    statusFilter === 'posted' ? 'No posted comments yet' :
                      'No rejected comments'}
              </h3>
              <p className="text-gray-400 text-sm">
                {statusFilter === 'pending_approval'
                  ? 'New comments will appear here when posts are discovered'
                  : statusFilter === 'scheduled'
                    ? 'Approved comments waiting to be posted will appear here'
                    : statusFilter === 'posted'
                      ? 'Comments that have been posted to LinkedIn appear here'
                      : 'Rejected comments are shown here for reference'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {comments.map((comment) => {
                const statusIcon = comment.status === 'pending_approval' ? Clock :
                  comment.status === 'scheduled' ? Calendar :
                    comment.status === 'posted' ? CheckCircle2 : Ban;
                const StatusIcon = statusIcon;
                const iconBgClass = comment.status === 'pending_approval' ? 'bg-amber-600/20' :
                  comment.status === 'scheduled' ? 'bg-blue-600/20' :
                    comment.status === 'posted' ? 'bg-green-600/20' : 'bg-red-600/20';
                const iconColorClass = comment.status === 'pending_approval' ? 'text-amber-400' :
                  comment.status === 'scheduled' ? 'text-blue-400' :
                    comment.status === 'posted' ? 'text-green-400' : 'text-red-400';

                // Determine the date to show based on status
                const displayDate = comment.status === 'posted' && comment.posted_at ? comment.posted_at :
                  comment.status === 'scheduled' && comment.scheduled_for ? comment.scheduled_for :
                    comment.status === 'rejected' && comment.rejected_at ? comment.rejected_at :
                      comment.created_at;

                return (
                  <button
                    key={comment.id}
                    onClick={() => {
                      setSelectedComment(comment);
                      setIsEditing(false);
                      setEditedComment('');
                    }}
                    className={`w-full p-4 text-left transition-colors ${selectedComment?.id === comment.id
                      ? 'bg-gray-800 border-l-2 border-pink-500'
                      : 'hover:bg-gray-800/50'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBgClass}`}>
                        <StatusIcon size={18} className={iconColorClass} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-white font-medium truncate">{comment.post_author}</p>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {new Date(displayDate).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm line-clamp-2">{comment.post_content}</p>
                        {comment.campaign_name && (
                          <p className="text-xs text-pink-400 mt-1">{comment.campaign_name}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel - Comment Detail */}
        <div className="flex-1 overflow-y-auto bg-gray-800/50">
          {selectedComment ? (
            <div className="p-6 max-w-3xl mx-auto">
              {/* Post Card */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {selectedComment.post_author.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{selectedComment.post_author}</p>
                      {selectedComment.post_author_headline && (
                        <p className="text-gray-400 text-sm">{selectedComment.post_author_headline}</p>
                      )}
                    </div>
                  </div>
                  <a
                    href={selectedComment.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                  >
                    View Post <ExternalLink size={14} />
                  </a>
                </div>
                <p className="text-gray-300 whitespace-pre-wrap">{selectedComment.post_content}</p>
              </div>

              {/* Generated Comment */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Generated Comment</h3>
                  {statusFilter === 'pending_approval' && (
                    <button
                      onClick={() => handleRegenerate(selectedComment.id)}
                      disabled={actionLoading === selectedComment.id}
                      className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={actionLoading === selectedComment.id ? 'animate-spin' : ''} />
                      Regenerate
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <textarea
                    value={editedComment}
                    onChange={(e) => setEditedComment(e.target.value)}
                    className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none min-h-[150px]"
                    autoFocus
                  />
                ) : (
                  <div className="p-4 bg-gray-700/50 rounded-lg">
                    <p className="text-gray-200 whitespace-pre-wrap">
                      {selectedComment.generated_comment}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                {statusFilter === 'pending_approval' && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              setEditedComment('');
                            }}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleApprove(selectedComment.id)}
                            disabled={actionLoading === selectedComment.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionLoading === selectedComment.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Send size={16} />
                            )}
                            Save & Approve
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleReject(selectedComment.id)}
                            disabled={actionLoading === selectedComment.id}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setEditedComment(selectedComment.generated_comment);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                          >
                            <Edit3 size={16} />
                            Edit
                          </button>
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <button
                        onClick={() => handleApprove(selectedComment.id)}
                        disabled={actionLoading === selectedComment.id}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        {actionLoading === selectedComment.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ThumbsUp size={16} />
                        )}
                        Approve & Post
                      </button>
                    )}
                  </div>
                )}

                {/* Status-specific info panels */}
                {statusFilter === 'scheduled' && (
                  <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg flex items-center gap-2">
                    <Calendar size={18} className="text-blue-400" />
                    <span className="text-blue-200 text-sm">
                      Scheduled to post {selectedComment.scheduled_for
                        ? `on ${new Date(selectedComment.scheduled_for).toLocaleString()}`
                        : 'soon'}
                    </span>
                  </div>
                )}

                {statusFilter === 'posted' && (
                  <div className="mt-4 p-3 bg-green-900/20 border border-green-700/30 rounded-lg flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className="text-green-200 text-sm">
                      Posted to LinkedIn {selectedComment.posted_at
                        ? `on ${new Date(selectedComment.posted_at).toLocaleString()}`
                        : ''}
                    </span>
                  </div>
                )}

                {statusFilter === 'rejected' && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg flex items-center gap-2">
                    <Ban size={18} className="text-red-400" />
                    <span className="text-red-200 text-sm">
                      Rejected {selectedComment.rejected_at
                        ? `on ${new Date(selectedComment.rejected_at).toLocaleString()}`
                        : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageSquare size={48} className="text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Select a comment</h3>
              <p className="text-gray-400 text-sm">
                Choose a comment from the list to review and approve
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
