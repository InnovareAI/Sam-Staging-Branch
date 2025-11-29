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
  Keyboard
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
  status: 'pending' | 'approved' | 'posted' | 'rejected';
  created_at: string;
  campaign_name?: string;
}

export default function ApproveCommentsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.workspaceId as string;
  const campaignFilter = searchParams.get('campaign');

  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PendingComment[]>([]);
  const [postedComments, setPostedComments] = useState<PendingComment[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'posted'>('pending');
  const [selectedComment, setSelectedComment] = useState<PendingComment | null>(null);
  const [editedComment, setEditedComment] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadComments();
  }, [workspaceId, campaignFilter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedComment || isEditing) return;

      switch (e.key) {
        case 'a':
          handleApprove(selectedComment.id);
          break;
        case 'e':
          setIsEditing(true);
          setEditedComment(selectedComment.generated_comment);
          break;
        case 'r':
          handleReject(selectedComment.id);
          break;
        case 'ArrowUp':
          navigateComments(-1);
          break;
        case 'ArrowDown':
          navigateComments(1);
          break;
        case 'Escape':
          setSelectedComment(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComment, isEditing, comments]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (campaignFilter) params.append('monitor_id', campaignFilter);

      const [pendingRes, postedRes] = await Promise.all([
        fetch(`/api/linkedin-commenting/comments?${params}&status=pending`),
        fetch(`/api/linkedin-commenting/comments?${params}&status=posted&limit=20`)
      ]);

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setComments(data.comments || []);
        if (data.comments?.length > 0 && !selectedComment) {
          setSelectedComment(data.comments[0]);
        }
      }

      if (postedRes.ok) {
        const data = await postedRes.json();
        setPostedComments(data.comments || []);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshComments = async () => {
    setRefreshing(true);
    await loadComments();
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

        // Refresh posted comments
        loadComments();
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
              <p className="text-gray-400 text-sm">{comments.length} pending approval</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Keyboard Shortcuts Help */}
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 mr-4">
              <Keyboard size={14} />
              <span><kbd className="bg-gray-700 px-1 rounded">A</kbd> Approve</span>
              <span><kbd className="bg-gray-700 px-1 rounded">E</kbd> Edit</span>
              <span><kbd className="bg-gray-700 px-1 rounded">R</kbd> Reject</span>
            </div>

            <button
              onClick={refreshComments}
              disabled={refreshing}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Tabs */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'pending'
                    ? 'bg-pink-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Pending ({comments.length})
              </button>
              <button
                onClick={() => setActiveTab('posted')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'posted'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Posted ({postedComments.length})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel - Comment List */}
        <div className="w-[400px] border-r border-gray-700 overflow-y-auto bg-gray-900">
          {(activeTab === 'pending' ? comments : postedComments).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageSquare size={48} className="text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {activeTab === 'pending' ? 'No pending comments' : 'No posted comments yet'}
              </h3>
              <p className="text-gray-400 text-sm">
                {activeTab === 'pending'
                  ? 'New comments will appear here when posts are discovered'
                  : 'Approved comments will appear here after being posted'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {(activeTab === 'pending' ? comments : postedComments).map((comment) => (
                <button
                  key={comment.id}
                  onClick={() => {
                    setSelectedComment(comment);
                    setIsEditing(false);
                    setEditedComment('');
                  }}
                  className={`w-full p-4 text-left transition-colors ${
                    selectedComment?.id === comment.id
                      ? 'bg-gray-800 border-l-2 border-pink-500'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      comment.status === 'pending' ? 'bg-amber-600/20' :
                      comment.status === 'posted' ? 'bg-green-600/20' : 'bg-gray-700'
                    }`}>
                      {comment.status === 'posted' ? (
                        <CheckCircle2 size={18} className="text-green-400" />
                      ) : (
                        <Clock size={18} className="text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-white font-medium truncate">{comment.post_author}</p>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm line-clamp-2">{comment.post_content}</p>
                      {comment.campaign_name && (
                        <p className="text-xs text-pink-400 mt-1">{comment.campaign_name}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
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
                  {activeTab === 'pending' && (
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
                {activeTab === 'pending' && (
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

                {/* Posted Status */}
                {activeTab === 'posted' && (
                  <div className="mt-4 p-3 bg-green-900/20 border border-green-700/30 rounded-lg flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-400" />
                    <span className="text-green-200 text-sm">
                      This comment was posted to LinkedIn
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
