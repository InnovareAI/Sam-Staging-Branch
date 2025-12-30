'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Edit3, ThumbsUp, MessageCircle, Eye, Clock, TrendingUp, ChevronRight, Sparkles, Filter, CheckSquare, Hash, Search, User as UserIcon, ArrowLeft, MessageSquare, Send, X, RefreshCw } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';

interface CommentApprovalWorkflowProps {
  workspaceId: string;
  onBack?: () => void;
}

interface PendingComment {
  id: string;
  postId: string;
  postAuthor: string;
  postAuthorTitle?: string;
  postContent: string;
  postUrl: string;
  postLikes: number;
  postComments: number;
  postAge: string;
  generatedComment: string;
  confidence: 'high' | 'medium' | 'low';
  campaignName: string;
  targetingMode: 'hashtag' | 'keyword' | 'profile';
  targetingValue: string;
  relevanceScore: number;
  scheduledPostTime?: string;
}

interface PostedComment {
  id: string;
  postId: string;
  postAuthor: string;
  postAuthorTitle?: string;
  postContent: string;
  postUrl: string;
  generatedComment: string;
  postedAt: string;
  linkedinCommentId?: string;
  engagementMetrics?: {
    likes_count?: number;
    replies_count?: number;
    last_checked?: string;
  };
  engagementCheckedAt?: string;
}

interface PostComment {
  id: string;
  author_name: string;
  author_profile_id: string;
  author_title?: string;
  author_profile_url?: string;
  author_avatar_url?: string;
  text: string;
  created_at: string;
  likes_count: number;
  replies_count: number;
  is_reply: boolean;
  parent_comment_id?: string;
}

export default function CommentApprovalWorkflow({ workspaceId, onBack }: CommentApprovalWorkflowProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'posted'>('pending');
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const [postedComments, setPostedComments] = useState<PostedComment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedComment, setEditedComment] = useState('');
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'age' | 'engagement'>('confidence');
  const [loading, setLoading] = useState(true);
  const [loadingPosted, setLoadingPosted] = useState(false);

  // Engagement tracking state
  const [refreshingEngagement, setRefreshingEngagement] = useState(false);

  // Comments modal state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentsModalPostId, setCommentsModalPostId] = useState<string | null>(null);
  const [commentsModalPostInfo, setCommentsModalPostInfo] = useState<{ author: string; content: string } | null>(null);
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<PostComment | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [generatingAiReply, setGeneratingAiReply] = useState(false);
  const [regeneratingComment, setRegeneratingComment] = useState(false);

  // Fetch real pending comments from database
  useEffect(() => {
    const fetchPendingComments = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/linkedin-commenting/pending-comments?workspace_id=${workspaceId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch pending comments');
        }
        const data = await response.json();

        // Transform database data to component format
        const comments: PendingComment[] = data.comments.map((c: any) => ({
          id: c.id,
          postId: c.post.id,
          postAuthor: c.post.author_name,
          postAuthorTitle: c.post.author_title || '',
          postContent: c.post.post_content,
          postUrl: c.post.share_url,
          postLikes: c.post.engagement_metrics?.reactions || 0,
          postComments: c.post.engagement_metrics?.comments || 0,
          postAge: getTimeAgo(c.post.post_date),
          generatedComment: c.comment_text,
          confidence: calculateConfidence(c.post.engagement_metrics),
          campaignName: c.monitor?.name || 'Unknown Campaign',
          targetingMode: 'profile' as const,
          targetingValue: c.post.author_profile_id || '',
          relevanceScore: calculateRelevance(c.post.engagement_metrics),
          scheduledPostTime: c.scheduled_post_time || undefined,
        }));

        setPendingComments(comments);
      } catch (error) {
        console.error('Error fetching pending comments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingComments();
  }, [workspaceId]);

  // Fetch posted comments history when tab changes
  useEffect(() => {
    const fetchPostedComments = async () => {
      if (activeTab !== 'posted') return;

      setLoadingPosted(true);
      try {
        const response = await fetch(`/api/linkedin-commenting/posted-comments?workspace_id=${workspaceId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch posted comments');
        }
        const data = await response.json();

        const posted: PostedComment[] = data.comments.map((c: any) => ({
          id: c.id,
          postId: c.post?.id || '',
          postAuthor: c.post?.author_name || 'Unknown',
          postAuthorTitle: c.post?.author_title || '',
          postContent: c.post?.post_content || '',
          postUrl: c.post?.share_url || '',
          generatedComment: c.comment_text,
          postedAt: c.posted_at,
          linkedinCommentId: c.linkedin_comment_id,
          engagementMetrics: c.engagement_metrics || {},
          engagementCheckedAt: c.engagement_checked_at,
        }));

        setPostedComments(posted);
      } catch (error) {
        console.error('Error fetching posted comments:', error);
        toastError('Failed to load posted comments');
      } finally {
        setLoadingPosted(false);
      }
    };

    fetchPostedComments();
  }, [workspaceId, activeTab]);

  // Helper function to calculate time ago
  const getTimeAgo = (dateString: string | null | undefined) => {
    // Handle null/undefined/invalid dates
    if (!dateString) return 'Unknown';

    const now = new Date();
    const past = new Date(dateString);

    // Check if date is invalid (returns NaN for getTime())
    if (isNaN(past.getTime())) return 'Unknown';

    const diffMs = now.getTime() - past.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // Helper function to calculate confidence level
  const calculateConfidence = (metrics: any): 'high' | 'medium' | 'low' => {
    const reactions = metrics?.reactions || 0;
    const comments = metrics?.comments || 0;
    const totalEngagement = reactions + comments * 2; // Comments weighted more

    if (totalEngagement >= 20) return 'high';
    if (totalEngagement >= 5) return 'medium';
    return 'low';
  };

  // Helper function to calculate relevance score
  const calculateRelevance = (metrics: any): number => {
    const reactions = metrics?.reactions || 0;
    const comments = metrics?.comments || 0;
    const reposts = metrics?.reposts || 0;

    // Simple scoring algorithm
    const score = Math.min(100, (reactions + comments * 3 + reposts * 2));
    return score;
  };

  const filteredComments = pendingComments
    .filter(c => filterConfidence === 'all' || c.confidence === filterConfidence)
    .sort((a, b) => {
      if (sortBy === 'confidence') {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.confidence] - order[b.confidence];
      }
      if (sortBy === 'engagement') {
        return (b.postLikes + b.postComments) - (a.postLikes + a.postComments);
      }
      return 0; // age sorting
    });

  // IMPORTANT: Use filteredComments, not pendingComments!
  // The selectedIndex corresponds to the filtered/sorted list shown in the UI
  const selectedComment = filteredComments[selectedIndex];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is editing
      if (editingCommentId) return;

      switch(e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredComments.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          handleApprove(selectedComment.id);
          break;
        case 'x':
        case 'Delete':
          e.preventDefault();
          handleReject(selectedComment.id);
          break;
        case 'e':
          e.preventDefault();
          handleStartEdit(selectedComment.id, selectedComment.generatedComment);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedIndex, filteredComments, editingCommentId, selectedComment]);

  const handleApprove = useCallback(async (id: string) => {
    console.log('Approving comment:', id);

    // Get the current comment text (may have been edited)
    const commentToApprove = pendingComments.find(c => c.id === id);
    const editedText = commentToApprove?.generatedComment;

    try {
      // Call API to approve comment, passing edited text if any
      const response = await fetch('/api/linkedin-commenting/approve-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment_id: id,
          edited_text: editedText  // Send the possibly-edited text
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve comment');
      }

      // Remove from local state
      setPendingComments(prev => prev.filter(c => c.id !== id));

      // Show success toast
      toastSuccess('Comment posted to LinkedIn!');

      // Auto-advance to next
      if (selectedIndex >= filteredComments.length - 1) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      }
    } catch (error) {
      console.error('Error approving comment:', error);
      toastError(error instanceof Error ? error.message : 'Failed to approve comment');
    }
  }, [selectedIndex, filteredComments.length, pendingComments]);

  const handleReject = useCallback(async (id: string) => {
    console.log('Rejecting comment:', id);

    try {
      // Call API to reject comment
      const response = await fetch('/api/linkedin-commenting/reject-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: id })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to reject comment');
      }

      // Remove from local state
      setPendingComments(prev => prev.filter(c => c.id !== id));

      // Show success toast
      toastSuccess('Comment rejected');

      // Auto-advance to next
      if (selectedIndex >= filteredComments.length - 1) {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      }
    } catch (error) {
      console.error('Error rejecting comment:', error);
      toastError(error instanceof Error ? error.message : 'Failed to reject comment');
    }
  }, [selectedIndex, filteredComments.length]);

  const handleStartEdit = (id: string, comment: string) => {
    setEditingCommentId(id);
    setEditedComment(comment);
  };

  const handleSaveEdit = () => {
    if (editingCommentId) {
      setPendingComments(prev => prev.map(c =>
        c.id === editingCommentId ? { ...c, generatedComment: editedComment } : c
      ));
      setEditingCommentId(null);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    console.log('Bulk approving:', ids);
    try {
      const response = await fetch('/api/linkedin-commenting/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_ids: ids })
      });

      if (!response.ok) {
        throw new Error('Bulk approve failed');
      }

      const result = await response.json();
      setPendingComments(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      setSelectedIndex(0);
      toastSuccess(`${result.success_count} comments posted to LinkedIn!`);
    } catch (error) {
      console.error('Bulk approve error:', error);
      toastError('Failed to bulk approve comments');
    }
  };

  const handleApproveAllHigh = async () => {
    const highConfidenceIds = pendingComments.filter(c => c.confidence === 'high').map(c => c.id);
    if (highConfidenceIds.length === 0) {
      toastError('No high confidence comments to approve');
      return;
    }

    console.log('Approving all high confidence:', highConfidenceIds);
    try {
      const response = await fetch('/api/linkedin-commenting/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_ids: highConfidenceIds })
      });

      if (!response.ok) {
        throw new Error('Bulk approve failed');
      }

      const result = await response.json();
      setPendingComments(prev => prev.filter(c => c.confidence !== 'high'));
      setSelectedIndex(0);
      toastSuccess(`${result.success_count} high confidence comments posted!`);
    } catch (error) {
      console.error('Approve all high error:', error);
      toastError('Failed to approve high confidence comments');
    }
  };

  // Open comments modal and fetch comments from LinkedIn
  const handleViewComments = async (postId: string, postAuthor: string, postContent: string) => {
    setCommentsModalPostId(postId);
    setCommentsModalPostInfo({ author: postAuthor, content: postContent });
    setShowCommentsModal(true);
    setLoadingComments(true);
    setPostComments([]);
    setReplyingToComment(null);
    setReplyText('');

    try {
      const response = await fetch(`/api/linkedin-commenting/get-post-comments?post_id=${postId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      const data = await response.json();
      setPostComments(data.comments || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toastError('Failed to load comments from LinkedIn');
    } finally {
      setLoadingComments(false);
    }
  };

  // Send reply to a comment
  const handleSendReply = async () => {
    if (!replyingToComment || !replyText.trim() || !commentsModalPostId) return;

    setSendingReply(true);
    try {
      const response = await fetch('/api/linkedin-commenting/reply-to-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: commentsModalPostId,
          comment_id: replyingToComment.id,
          reply_text: replyText.trim(),
          original_comment_text: replyingToComment.text,
          original_comment_author_name: replyingToComment.author_name,
          original_comment_author_profile_id: replyingToComment.author_profile_id,
          mention_author: {
            name: replyingToComment.author_name,
            profile_id: replyingToComment.author_profile_id
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send reply');
      }

      toastSuccess(`Reply sent to ${replyingToComment.author_name}!`);
      setReplyingToComment(null);
      setReplyText('');

      // Refresh comments to show our reply
      handleViewComments(commentsModalPostId, commentsModalPostInfo?.author || '', commentsModalPostInfo?.content || '');
    } catch (error) {
      console.error('Error sending reply:', error);
      toastError(error instanceof Error ? error.message : 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Close comments modal
  const handleCloseCommentsModal = () => {
    setShowCommentsModal(false);
    setCommentsModalPostId(null);
    setCommentsModalPostInfo(null);
    setPostComments([]);
    setReplyingToComment(null);
    setReplyText('');
  };

  // Ask Sam - Generate AI-powered reply suggestion
  const handleAskSam = async () => {
    if (!replyingToComment || !commentsModalPostId) return;

    setGeneratingAiReply(true);
    try {
      const response = await fetch('/api/linkedin-commenting/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: commentsModalPostId,
          original_comment_text: replyingToComment.text,
          original_comment_author: replyingToComment.author_name,
          workspace_id: workspaceId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate reply');
      }

      const data = await response.json();
      if (data.reply) {
        setReplyText(data.reply);
        toastSuccess('Sam suggested a reply! Edit it if needed.');
      }
    } catch (error) {
      console.error('Error generating AI reply:', error);
      toastError(error instanceof Error ? error.message : 'Failed to generate reply');
    } finally {
      setGeneratingAiReply(false);
    }
  };

  // Ask Sam - Regenerate the comment with AI
  const handleAskSamRegenerate = async (commentId: string, postId: string) => {
    setRegeneratingComment(true);
    try {
      const response = await fetch(`/api/linkedin-commenting/comments/${postId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to regenerate comment');
      }

      const data = await response.json();
      if (data.comment) {
        // Update the local state with the new comment
        setPendingComments(prev => prev.map(c =>
          c.id === commentId ? { ...c, generatedComment: data.comment } : c
        ));
        toastSuccess('Sam generated a new comment! Review it before approving.');
      }
    } catch (error) {
      console.error('Error regenerating comment:', error);
      toastError(error instanceof Error ? error.message : 'Failed to regenerate comment');
    } finally {
      setRegeneratingComment(false);
    }
  };

  // Refresh engagement metrics for all posted comments
  const handleRefreshEngagement = async () => {
    setRefreshingEngagement(true);
    try {
      const response = await fetch('/api/linkedin-commenting/refresh-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh engagement');
      }

      const result = await response.json();
      toastSuccess(`Updated engagement for ${result.updated} comments`);

      // Refetch posted comments to show updated engagement
      const fetchResponse = await fetch(`/api/linkedin-commenting/posted-comments?workspace_id=${workspaceId}`);
      if (fetchResponse.ok) {
        const data = await fetchResponse.json();
        const posted: PostedComment[] = data.comments.map((c: any) => ({
          id: c.id,
          postId: c.post?.id || '',
          postAuthor: c.post?.author_name || 'Unknown',
          postAuthorTitle: c.post?.author_title || '',
          postContent: c.post?.post_content || '',
          postUrl: c.post?.share_url || '',
          generatedComment: c.comment_text,
          postedAt: c.posted_at,
          linkedinCommentId: c.linkedin_comment_id,
          engagementMetrics: c.engagement_metrics || {},
          engagementCheckedAt: c.engagement_checked_at,
        }));
        setPostedComments(posted);
      }
    } catch (error) {
      console.error('Error refreshing engagement:', error);
      toastError('Failed to refresh engagement metrics');
    } finally {
      setRefreshingEngagement(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch(confidence) {
      case 'high': return 'text-green-400 bg-green-900/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30';
      case 'low': return 'text-orange-400 bg-orange-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  const getTargetingIcon = (mode: string) => {
    switch(mode) {
      case 'hashtag': return Hash;
      case 'keyword': return Search;
      case 'profile': return UserIcon;
      default: return Hash;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Clock size={48} className="animate-spin text-pink-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading pending comments...</p>
        </div>
      </div>
    );
  }

  if (filteredComments.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-2">All caught up!</h2>
          <p className="text-gray-400">No comments pending approval</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Back to Dashboard"
              >
                <ArrowLeft size={24} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-white">Comment Management</h1>
              {/* Tab Navigation */}
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={() => { setActiveTab('pending'); setSelectedIndex(0); }}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                    activeTab === 'pending'
                      ? 'text-pink-400 border-pink-400'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  Pending Approval ({filteredComments.length})
                </button>
                <button
                  onClick={() => { setActiveTab('posted'); setSelectedIndex(0); }}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                    activeTab === 'posted'
                      ? 'text-green-400 border-green-400'
                      : 'text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  Posted ({postedComments.length})
                </button>
              </div>
              {activeTab === 'pending' && (
                <p className="text-xs text-gray-500 mt-1">
                  Use ↑↓ arrows to navigate, Space to approve, X to reject
                </p>
              )}
            </div>
          </div>
          {/* Controls - only show for pending tab */}
          {activeTab === 'pending' && (
          <div className="flex items-center gap-3">
            {/* Filter */}
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value as any)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">All Confidence</option>
              <option value="high">High Confidence</option>
              <option value="medium">Medium Confidence</option>
              <option value="low">Low Confidence</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            >
              <option value="confidence">Sort by Confidence</option>
              <option value="engagement">Sort by Engagement</option>
              <option value="age">Sort by Age</option>
            </select>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <CheckSquare size={16} />
                Approve {selectedIds.size} Selected
              </button>
            )}

            <button
              onClick={handleApproveAllHigh}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Sparkles size={16} />
              Approve All High ({pendingComments.filter(c => c.confidence === 'high').length})
            </button>
          </div>
          )}
        </div>
      </div>

      {/* Two-Pane Layout - Pending Tab */}
      {activeTab === 'pending' && (
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Compact List */}
        <div className="w-96 bg-gray-800 border-r border-gray-700 overflow-y-auto">
          {filteredComments.map((comment, index) => {
            const Icon = getTargetingIcon(comment.targetingMode);
            return (
              <div
                key={comment.id}
                onClick={() => setSelectedIndex(index)}
                className={`p-4 border-b border-gray-700 cursor-pointer transition-colors ${
                  index === selectedIndex ? 'bg-pink-900/30 border-l-4 border-l-pink-500' : 'hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(comment.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleSelect(comment.id);
                    }}
                    className="mt-1 w-4 h-4 rounded border-gray-600 text-pink-600 focus:ring-pink-500"
                  />

                  <div className="flex-1 min-w-0">
                    {/* Author */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white text-sm truncate">{comment.postAuthor}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(comment.confidence)}`}>
                        {comment.confidence}
                      </span>
                    </div>

                    {/* Post snippet */}
                    <p className="text-xs text-gray-400 line-clamp-2 mb-2">
                      {comment.postContent}
                    </p>

                    {/* Comment preview */}
                    <p className="text-xs text-gray-300 line-clamp-2 mb-2 italic">
                      "{comment.generatedComment}"
                    </p>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Icon size={12} />
                        {comment.targetingValue}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp size={12} />
                        {comment.postLikes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} />
                        {comment.postComments}
                      </span>
                      <span>{comment.postAge}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Main Area - Full Preview */}
        <div className="flex-1 overflow-y-auto p-8">
          {selectedComment && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Campaign Info */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Campaign:</span>
                <span className="text-white font-medium">{selectedComment.campaignName}</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${getConfidenceColor(selectedComment.confidence)}`}>
                  {selectedComment.confidence.toUpperCase()} CONFIDENCE ({selectedComment.relevanceScore}% relevance)
                </span>
              </div>

              {/* LinkedIn Post */}
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">LinkedIn Post</h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleViewComments(selectedComment.postId, selectedComment.postAuthor, selectedComment.postContent)}
                      className="text-green-400 hover:text-green-300 text-sm flex items-center gap-1"
                    >
                      <MessageSquare size={16} />
                      View Comments ({selectedComment.postComments})
                    </button>
                    <a
                      href={selectedComment.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                    >
                      <Eye size={16} />
                      View on LinkedIn
                    </a>
                  </div>
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedComment.postAuthor[0]}
                  </div>
                  <div>
                    <div className="font-medium text-white">{selectedComment.postAuthor}</div>
                    {selectedComment.postAuthorTitle && (
                      <div className="text-sm text-gray-400">{selectedComment.postAuthorTitle}</div>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <p className="text-gray-300 leading-relaxed mb-4 whitespace-pre-wrap">
                  {selectedComment.postContent}
                </p>

                {/* Engagement Stats */}
                <div className="flex items-center gap-6 text-sm text-gray-400 pt-4 border-t border-gray-700">
                  <span className="flex items-center gap-2">
                    <ThumbsUp size={16} className="text-blue-400" />
                    {selectedComment.postLikes} likes
                  </span>
                  <span className="flex items-center gap-2">
                    <MessageCircle size={16} className="text-green-400" />
                    {selectedComment.postComments} comments
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock size={16} className="text-yellow-400" />
                    {selectedComment.postAge}
                  </span>
                  <span className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-pink-400" />
                    {selectedComment.scheduledPostTime}
                  </span>
                </div>
              </div>

              {/* Your Comment */}
              <div className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 rounded-lg border border-pink-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Your Comment</h3>
                  {editingCommentId !== selectedComment.id && (
                    <div className="flex items-center gap-3">
                      {/* Ask Sam Button */}
                      <button
                        onClick={() => handleAskSamRegenerate(selectedComment.id, selectedComment.postId)}
                        disabled={regeneratingComment}
                        className="px-3 py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
                      >
                        {regeneratingComment ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            Thinking...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} />
                            Ask Sam
                          </>
                        )}
                      </button>
                      {/* Edit Button */}
                      <button
                        onClick={() => handleStartEdit(selectedComment.id, selectedComment.generatedComment)}
                        className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1"
                      >
                        <Edit3 size={16} />
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {editingCommentId === selectedComment.id ? (
                  <div>
                    <textarea
                      value={editedComment}
                      onChange={(e) => setEditedComment(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingCommentId(null)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-800/50 rounded-lg p-4 text-gray-300 leading-relaxed">
                    {selectedComment.generatedComment}
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-3">
                  {selectedComment.generatedComment.length} characters · Generated with SAM AI
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => handleReject(selectedComment.id)}
                  className="flex-1 px-6 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle size={20} />
                  Reject (X)
                </button>
                <button
                  onClick={() => handleApprove(selectedComment.id)}
                  className="flex-1 px-6 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle size={20} />
                  Approve & Schedule (Space)
                </button>
              </div>

              {/* Keyboard Shortcuts Help */}
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                <div className="text-sm text-blue-300">
                  <span className="font-semibold">Keyboard Shortcuts:</span> ↑↓ Navigate · Space Approve · X Reject · E Edit
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Posted Comments History Tab */}
      {activeTab === 'posted' && (
        <div className="flex-1 overflow-y-auto p-6">
          {loadingPosted ? (
            <div className="flex items-center justify-center h-64">
              <Clock size={32} className="animate-spin text-green-500 mr-3" />
              <span className="text-gray-400">Loading posted comments...</span>
            </div>
          ) : postedComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MessageCircle size={48} className="text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Posted Comments Yet</h3>
              <p className="text-gray-400">Approved comments will appear here after they're posted to LinkedIn.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Posted Comments History</h2>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{postedComments.length} comments posted</span>
                  <button
                    onClick={handleRefreshEngagement}
                    disabled={refreshingEngagement}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={14} className={refreshingEngagement ? 'animate-spin' : ''} />
                    {refreshingEngagement ? 'Refreshing...' : 'Refresh Engagement'}
                  </button>
                </div>
              </div>

              {postedComments.map((comment) => (
                <div key={comment.id} className="bg-gray-800 rounded-lg border border-gray-700 p-5 hover:border-green-700/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Author Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {comment.postAuthor[0]}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-medium text-white">{comment.postAuthor}</span>
                          {comment.postAuthorTitle && (
                            <span className="text-sm text-gray-400 ml-2">· {comment.postAuthorTitle}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock size={12} />
                            {getTimeAgo(comment.postedAt)}
                          </span>
                          <a
                            href={comment.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                          >
                            <Eye size={12} />
                            View
                          </a>
                        </div>
                      </div>

                      {/* Post Snippet */}
                      <p className="text-xs text-gray-400 line-clamp-2 mb-3">
                        {comment.postContent}
                      </p>

                      {/* Your Comment */}
                      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-gray-200">{comment.generatedComment}</p>
                      </div>

                      {/* Engagement Stats */}
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <ThumbsUp size={12} className="text-blue-400" />
                          {comment.engagementMetrics?.likes_count || 0} likes
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={12} className="text-green-400" />
                          {comment.engagementMetrics?.replies_count || 0} replies
                        </span>
                        {comment.engagementCheckedAt && (
                          <span className="text-gray-500">
                            Updated {getTimeAgo(comment.engagementCheckedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comments Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MessageSquare size={20} className="text-green-400" />
                  Comments on Post
                </h3>
                {commentsModalPostInfo && (
                  <p className="text-sm text-gray-400 mt-1 truncate max-w-md">
                    By {commentsModalPostInfo.author}
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseCommentsModal}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingComments ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={24} className="animate-spin text-green-500 mr-3" />
                  <span className="text-gray-400">Loading comments from LinkedIn...</span>
                </div>
              ) : postComments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle size={40} className="text-gray-600 mb-3" />
                  <p className="text-gray-400">No comments yet on this post</p>
                </div>
              ) : (
                postComments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      replyingToComment?.id === comment.id
                        ? 'bg-green-900/20 border-green-700/50'
                        : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {comment.author_name[0]}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Author Info */}
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <span className="font-medium text-white">{comment.author_name}</span>
                            {comment.author_title && (
                              <span className="text-xs text-gray-400 ml-2">{comment.author_title}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {getTimeAgo(comment.created_at)}
                          </span>
                        </div>

                        {/* Comment Text */}
                        <p className="text-gray-300 text-sm mb-2">{comment.text}</p>

                        {/* Comment Stats & Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <ThumbsUp size={12} />
                              {comment.likes_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle size={12} />
                              {comment.replies_count}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setReplyingToComment(comment);
                              setReplyText(`@${comment.author_name} `);
                            }}
                            className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
                          >
                            <MessageSquare size={12} />
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply Input */}
            {replyingToComment && (
              <div className="p-4 border-t border-gray-700 bg-gray-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-400">Replying to</span>
                  <span className="text-sm text-green-400 font-medium">{replyingToComment.author_name}</span>
                  <button
                    onClick={handleAskSam}
                    disabled={generatingAiReply}
                    className="ml-auto px-3 py-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-full text-xs font-medium transition-all flex items-center gap-1.5"
                  >
                    {generatingAiReply ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        Ask Sam
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setReplyingToComment(null);
                      setReplyText('');
                    }}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply or click 'Ask Sam' for a suggestion..."
                    rows={2}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyText.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {sendingReply ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
