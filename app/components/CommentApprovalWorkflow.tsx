'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Edit3, ThumbsUp, MessageCircle, Eye, Clock, TrendingUp, ChevronRight, Sparkles, Filter, CheckSquare, Hash, Search, User as UserIcon } from 'lucide-react';

interface CommentApprovalWorkflowProps {
  workspaceId: string;
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

export default function CommentApprovalWorkflow({ workspaceId }: CommentApprovalWorkflowProps) {
  const [pendingComments, setPendingComments] = useState<PendingComment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedComment, setEditedComment] = useState('');
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'age' | 'engagement'>('confidence');
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    // TODO: Replace with actual API call
    const mockComments: PendingComment[] = [
      {
        id: '1',
        postId: 'post-1',
        postAuthor: 'Sarah Chen',
        postAuthorTitle: 'CEO at TechStartup Inc.',
        postContent: 'Just launched our new SaaS platform after 2 years of development! 🚀 The journey from idea to execution has been incredible. Key lesson: Focus on solving ONE problem really well before expanding.',
        postUrl: 'https://linkedin.com/posts/sarahchen_saas-startup-launch',
        postLikes: 47,
        postComments: 12,
        postAge: '2 hours ago',
        generatedComment: 'Congratulations on the launch, Sarah! 🎉 Your focus on solving one problem well resonates deeply. What was the biggest technical challenge you faced during those 2 years?',
        confidence: 'high',
        campaignName: 'SaaS Founders Engagement',
        targetingMode: 'hashtag',
        targetingValue: '#SaaS',
        relevanceScore: 94,
        scheduledPostTime: 'In 25 minutes',
      },
      {
        id: '2',
        postId: 'post-2',
        postAuthor: 'Michael Rodriguez',
        postAuthorTitle: 'VP Sales at Enterprise Solutions',
        postContent: 'Sales automation is transforming how we approach outreach. Our team increased qualified leads by 300% this quarter using AI-powered tools. The future is here.',
        postUrl: 'https://linkedin.com/posts/mrodriguez_sales-automation',
        postLikes: 23,
        postComments: 8,
        postAge: '4 hours ago',
        generatedComment: 'Impressive results, Michael! 300% increase is remarkable. Which specific AI tools did you find most effective for lead qualification?',
        confidence: 'high',
        campaignName: 'Sales Automation Keywords',
        targetingMode: 'keyword',
        targetingValue: 'sales automation',
        relevanceScore: 89,
        scheduledPostTime: 'In 32 minutes',
      },
      {
        id: '3',
        postId: 'post-3',
        postAuthor: 'David Kim',
        postAuthorTitle: 'Founder & CTO',
        postContent: 'Hot take: Most startups overcomplicate their tech stack. We rebuilt our entire platform with 3 tools instead of 15. Faster, cheaper, less headaches.',
        postUrl: 'https://linkedin.com/posts/davidkim_startup-tech',
        postLikes: 156,
        postComments: 34,
        postAge: '6 hours ago',
        generatedComment: 'Love this approach! Simplicity is underrated. What were the 3 tools you kept, and which 12 did you eliminate?',
        confidence: 'medium',
        campaignName: 'SaaS Founders Engagement',
        targetingMode: 'hashtag',
        targetingValue: '#startup',
        relevanceScore: 78,
        scheduledPostTime: 'In 45 minutes',
      },
    ];

    setTimeout(() => {
      setPendingComments(mockComments);
      setLoading(false);
    }, 500);
  }, [workspaceId]);

  const selectedComment = pendingComments[selectedIndex];

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

  const handleApprove = useCallback((id: string) => {
    console.log('Approving comment:', id);
    setPendingComments(prev => prev.filter(c => c.id !== id));
    // Auto-advance to next
    if (selectedIndex >= filteredComments.length - 1) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
  }, [selectedIndex, filteredComments.length]);

  const handleReject = useCallback((id: string) => {
    console.log('Rejecting comment:', id);
    setPendingComments(prev => prev.filter(c => c.id !== id));
    if (selectedIndex >= filteredComments.length - 1) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
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

  const handleBulkApprove = () => {
    console.log('Bulk approving:', Array.from(selectedIds));
    setPendingComments(prev => prev.filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    setSelectedIndex(0);
  };

  const handleApproveAllHigh = () => {
    const highConfidenceIds = pendingComments.filter(c => c.confidence === 'high').map(c => c.id);
    console.log('Approving all high confidence:', highConfidenceIds);
    setPendingComments(prev => prev.filter(c => c.confidence !== 'high'));
    setSelectedIndex(0);
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
          <h2 className="text-2xl font-bold text-white mb-2">All caught up!</h2>
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
          <div>
            <h1 className="text-2xl font-bold text-white">Approve Comments</h1>
            <p className="text-sm text-gray-400 mt-1">
              {filteredComments.length} pending · Use ↑↓ arrows to navigate, Space to approve, X to reject
            </p>
          </div>
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
        </div>
      </div>

      {/* Two-Pane Layout */}
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

                {/* Author */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
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
                    <button
                      onClick={() => handleStartEdit(selectedComment.id, selectedComment.generatedComment)}
                      className="text-pink-400 hover:text-pink-300 text-sm flex items-center gap-1"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
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
                  {selectedComment.generatedComment.length} characters · Generated with Haiku 4.5
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
    </div>
  );
}
