/**
 * Comment Performance Tracker
 *
 * Tracks actual engagement on our posted comments to learn what works.
 * Uses Unipile API to check reactions/replies on our comments.
 *
 * Key metrics:
 * - Reactions on our comments
 * - Replies to our comments
 * - Whether the post author engaged
 *
 * Created: December 16, 2025
 */

import { Pool } from 'pg';

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

export interface CommentPerformance {
  comment_id: string;
  reactions_count: number;
  replies_count: number;
  author_replied: boolean;
  author_liked: boolean;
  performance_score: number;
}

export interface PerformanceStats {
  total_comments: number;
  total_with_engagement: number;
  avg_reactions: number;
  avg_replies: number;
  author_response_rate: number;
  by_comment_type: Record<string, { count: number; avg_reactions: number; avg_replies: number }>;
  by_length_category: Record<string, { count: number; avg_reactions: number; avg_replies: number }>;
  top_performing_openers: string[];
}

/**
 * Check engagement on a single posted comment
 */
export async function checkCommentEngagement(
  commentLinkedInId: string,
  postLinkedInId: string,
  accountId: string,
  originalPostAuthorId?: string
): Promise<CommentPerformance | null> {
  if (!UNIPILE_API_KEY) {
    console.error('UNIPILE_API_KEY not configured');
    return null;
  }

  try {
    // Fetch comment details from Unipile
    // The comment ID format may vary - try to get engagement from the post's comments
    const response = await fetch(
      `https://${UNIPILE_DSN}/api/v1/posts/${postLinkedInId}/comments?account_id=${accountId}`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch comments: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const comments = data.items || data.comments || [];

    // Find our comment in the list
    const ourComment = comments.find((c: any) =>
      c.id === commentLinkedInId ||
      c.comment_id === commentLinkedInId
    );

    if (!ourComment) {
      console.log(`Comment ${commentLinkedInId} not found in post comments`);
      return null;
    }

    // Extract engagement metrics
    const reactions = ourComment.reactions_count || ourComment.likes_count || 0;
    const replies = ourComment.replies_count || ourComment.comments_count || 0;

    // Check if original post author engaged
    let authorReplied = false;
    let authorLiked = false;

    if (originalPostAuthorId) {
      // Check replies for author
      const commentReplies = ourComment.replies || [];
      authorReplied = commentReplies.some((r: any) =>
        r.author_id === originalPostAuthorId ||
        r.author?.id === originalPostAuthorId
      );

      // Check reactions for author (if available)
      const reactors = ourComment.reactors || ourComment.likers || [];
      authorLiked = reactors.some((r: any) =>
        r.id === originalPostAuthorId ||
        r === originalPostAuthorId
      );
    }

    // Calculate performance score (0-100)
    const performanceScore = calculatePerformanceScore(reactions, replies, authorReplied, authorLiked);

    return {
      comment_id: commentLinkedInId,
      reactions_count: reactions,
      replies_count: replies,
      author_replied: authorReplied,
      author_liked: authorLiked,
      performance_score: performanceScore,
    };

  } catch (error) {
    console.error(`Error checking comment engagement:`, error);
    return null;
  }
}

/**
 * Calculate performance score based on engagement
 *
 * Scoring:
 * - Base: 0 points
 * - Each reaction: +5 points (max 40)
 * - Each reply: +10 points (max 30)
 * - Author replied: +20 points
 * - Author liked: +10 points
 */
function calculatePerformanceScore(
  reactions: number,
  replies: number,
  authorReplied: boolean,
  authorLiked: boolean
): number {
  let score = 0;

  // Reactions (5 points each, max 40)
  score += Math.min(40, reactions * 5);

  // Replies (10 points each, max 30)
  score += Math.min(30, replies * 10);

  // Author engagement (bonus)
  if (authorReplied) score += 20;
  if (authorLiked) score += 10;

  return Math.min(100, score);
}

/**
 * Update comment performance in database
 */
export async function updateCommentPerformance(
  supabase: SupabaseClient,
  commentId: string,
  performance: CommentPerformance
): Promise<boolean> {
  const { error } = await supabase
    .from('linkedin_post_comments')
    .update({
      reactions_count: performance.reactions_count,
      replies_count: performance.replies_count,
      author_replied: performance.author_replied,
      author_liked: performance.author_liked,
      performance_score: performance.performance_score,
      last_engagement_check: new Date().toISOString(),
    })
    .eq('id', commentId);

  if (error) {
    console.error(`Failed to update comment ${commentId}:`, error);
    return false;
  }

  return true;
}

/**
 * Batch check performance for all recent posted comments
 */
export async function checkRecentCommentsPerformance(
  supabase: SupabaseClient,
  workspaceId: string,
  accountId: string,
  daysSincePosted: number = 7
): Promise<{ checked: number; updated: number }> {
  // Get posted comments from last N days that haven't been checked in 24 hours
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSincePosted);

  const checkCutoff = new Date();
  checkCutoff.setHours(checkCutoff.getHours() - 24);

  const { data: comments, error } = await supabase
    .from('linkedin_post_comments')
    .select(`
      id,
      linkedin_comment_id,
      post:linkedin_posts_discovered!inner(
        social_id,
        author_profile_id
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('status', 'posted')
    .gte('posted_at', cutoffDate.toISOString())
    .or(`last_engagement_check.is.null,last_engagement_check.lt.${checkCutoff.toISOString()}`)
    .limit(20);  // Limit to avoid API rate limits

  if (error) {
    console.error('Failed to fetch comments for performance check:', error);
    return { checked: 0, updated: 0 };
  }

  if (!comments || comments.length === 0) {
    return { checked: 0, updated: 0 };
  }

  let checked = 0;
  let updated = 0;

  for (const comment of comments) {
    if (!comment.linkedin_comment_id) continue;

    const post = comment.post as any;
    if (!post?.social_id) continue;

    const performance = await checkCommentEngagement(
      comment.linkedin_comment_id,
      post.social_id,
      accountId,
      post.author_profile_id
    );

    checked++;

    if (performance) {
      const success = await updateCommentPerformance(supabase, comment.id, performance);
      if (success) updated++;
    }

    // Rate limit: 1 second between API calls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { checked, updated };
}

/**
 * Aggregate performance stats for a workspace
 */
export async function aggregatePerformanceStats(
  supabase: SupabaseClient,
  workspaceId: string,
  periodDays: number = 30
): Promise<PerformanceStats | null> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - periodDays);

  // Get all posted comments with performance data
  const { data: comments, error } = await supabase
    .from('linkedin_post_comments')
    .select('*, generation_metadata')
    .eq('workspace_id', workspaceId)
    .eq('status', 'posted')
    .gte('posted_at', cutoffDate.toISOString());

  if (error || !comments) {
    console.error('Failed to fetch comments for aggregation:', error);
    return null;
  }

  const total = comments.length;
  if (total === 0) {
    return {
      total_comments: 0,
      total_with_engagement: 0,
      avg_reactions: 0,
      avg_replies: 0,
      author_response_rate: 0,
      by_comment_type: {},
      by_length_category: {},
      top_performing_openers: [],
    };
  }

  // Calculate aggregate stats
  let totalReactions = 0;
  let totalReplies = 0;
  let authorResponded = 0;
  let withEngagement = 0;

  const byType: Record<string, { reactions: number; replies: number; count: number }> = {};
  const byLength: Record<string, { reactions: number; replies: number; count: number }> = {};
  const openerPerformance: Map<string, { score: number; count: number }> = new Map();

  for (const comment of comments) {
    const reactions = comment.reactions_count || 0;
    const replies = comment.replies_count || 0;

    totalReactions += reactions;
    totalReplies += replies;

    if (reactions > 0 || replies > 0) withEngagement++;
    if (comment.author_replied) authorResponded++;

    // Extract metadata
    const metadata = comment.generation_metadata || {};
    const commentType = metadata.comment_type || 'unknown';
    const lengthCategory = getLengthCategory(comment.comment_text?.length || 0);

    // Aggregate by type
    if (!byType[commentType]) {
      byType[commentType] = { reactions: 0, replies: 0, count: 0 };
    }
    byType[commentType].reactions += reactions;
    byType[commentType].replies += replies;
    byType[commentType].count++;

    // Aggregate by length
    if (!byLength[lengthCategory]) {
      byLength[lengthCategory] = { reactions: 0, replies: 0, count: 0 };
    }
    byLength[lengthCategory].reactions += reactions;
    byLength[lengthCategory].replies += replies;
    byLength[lengthCategory].count++;

    // Track opener performance
    const opener = extractOpener(comment.comment_text);
    if (opener && comment.performance_score) {
      const current = openerPerformance.get(opener) || { score: 0, count: 0 };
      openerPerformance.set(opener, {
        score: current.score + comment.performance_score,
        count: current.count + 1,
      });
    }
  }

  // Convert to final format
  const byTypeFormatted: Record<string, { count: number; avg_reactions: number; avg_replies: number }> = {};
  for (const [type, data] of Object.entries(byType)) {
    byTypeFormatted[type] = {
      count: data.count,
      avg_reactions: Math.round((data.reactions / data.count) * 100) / 100,
      avg_replies: Math.round((data.replies / data.count) * 100) / 100,
    };
  }

  const byLengthFormatted: Record<string, { count: number; avg_reactions: number; avg_replies: number }> = {};
  for (const [length, data] of Object.entries(byLength)) {
    byLengthFormatted[length] = {
      count: data.count,
      avg_reactions: Math.round((data.reactions / data.count) * 100) / 100,
      avg_replies: Math.round((data.replies / data.count) * 100) / 100,
    };
  }

  // Get top performing openers
  const topOpeners = Array.from(openerPerformance.entries())
    .filter(([_, data]) => data.count >= 3)  // At least 3 uses
    .map(([opener, data]) => ({ opener, avgScore: data.score / data.count }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5)
    .map(o => o.opener);

  return {
    total_comments: total,
    total_with_engagement: withEngagement,
    avg_reactions: Math.round((totalReactions / total) * 100) / 100,
    avg_replies: Math.round((totalReplies / total) * 100) / 100,
    author_response_rate: Math.round((authorResponded / total) * 100),
    by_comment_type: byTypeFormatted,
    by_length_category: byLengthFormatted,
    top_performing_openers: topOpeners,
  };
}

/**
 * Categorize comment length
 */
function getLengthCategory(length: number): string {
  if (length < 50) return 'very_short';
  if (length < 100) return 'short';
  if (length < 200) return 'medium';
  if (length < 350) return 'long';
  return 'very_long';
}

/**
 * Extract first phrase as opener pattern
 */
function extractOpener(text?: string): string | null {
  if (!text) return null;

  // Get first sentence or first 50 chars
  const firstSentence = text.split(/[.!?]/)[0]?.trim();
  if (!firstSentence) return null;

  // Normalize: lowercase, remove specific names/companies
  let normalized = firstSentence
    .toLowerCase()
    .replace(/\b(i|we|my|our)\b/g, '[personal]')
    .replace(/\d+/g, '[num]')
    .trim();

  // Truncate if too long
  if (normalized.length > 60) {
    normalized = normalized.substring(0, 60) + '...';
  }

  return normalized;
}
