/**
 * LinkedIn Comment Replies Service
 *
 * Handles fetching comments on posts and scoring them for quality.
 * Used by auto-generate-comments to decide whether to reply to a comment
 * or comment directly on the post.
 *
 * Split: 70% post comments, 30% comment replies
 * Quality threshold: 5+ reactions
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

// Configuration
const MIN_REACTIONS_THRESHOLD = 5;  // 5+ reactions = quality comment
const REPLY_PROBABILITY = 0.30;     // 30% chance to reply to comment (70% post comment)

export interface LinkedInComment {
  id: string;
  text: string;
  author_name: string;
  author_profile_id?: string;
  reactions_count: number;
  replies_count: number;
  created_at?: string;
}

export interface QualityComment extends LinkedInComment {
  quality_score: number;
}

/**
 * Fetch comments on a LinkedIn post using Unipile API
 *
 * @param postSocialId - The LinkedIn activity ID (social_id from our database)
 * @returns Array of comments or empty array if failed
 */
export async function fetchPostComments(postSocialId: string): Promise<LinkedInComment[]> {
  if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
    console.log('   ⚠️ Unipile not configured, skipping comment fetch');
    return [];
  }

  if (!postSocialId) {
    console.log('   ⚠️ No social_id provided, skipping comment fetch');
    return [];
  }

  try {
    const baseUrl = `https://${UNIPILE_DSN}`;
    const headers = {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    };

    // Unipile endpoint for post comments
    // The post ID needs to be the full URN or activity ID
    const postUrn = postSocialId.includes('activity')
      ? postSocialId
      : `urn:li:activity:${postSocialId}`;

    const commentsUrl = `${baseUrl}/api/v1/posts/${encodeURIComponent(postUrn)}/comments?account_id=${UNIPILE_ACCOUNT_ID}&limit=20`;

    console.log(`   🔍 Fetching comments for post ${postSocialId.substring(0, 20)}...`);

    const response = await fetch(commentsUrl, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ⚠️ Could not fetch comments: ${response.status} - ${errorText.substring(0, 100)}`);
      return [];
    }

    const data = await response.json();
    const items = data.items || data || [];

    const comments: LinkedInComment[] = items.map((item: any) => ({
      id: item.id || item.comment_id,
      text: item.text || item.comment || '',
      author_name: item.author?.name || item.commenter_name || 'Unknown',
      author_profile_id: item.author?.public_identifier || item.author?.id,
      reactions_count: item.reactions_count || item.likes_count || item.num_likes || 0,
      replies_count: item.replies_count || item.num_replies || 0,
      created_at: item.created_at || item.date
    }));

    console.log(`   📝 Found ${comments.length} comments on post`);
    return comments;

  } catch (error) {
    console.log(`   ⚠️ Error fetching comments: ${error instanceof Error ? error.message : 'Unknown'}`);
    return [];
  }
}

/**
 * Score a comment for quality
 *
 * Factors:
 * - Reactions (30%): 5+ = 30 points, 10+ = 30 points
 * - Length (25%): 50-200 chars = 25 points, thoughtful content
 * - Replies (20%): Has replies = engaging discussion
 * - Text quality (25%): Not spam, has substance
 */
export function scoreCommentQuality(comment: LinkedInComment): number {
  let score = 0;

  // Reactions score (30 points max)
  if (comment.reactions_count >= 10) {
    score += 30;
  } else if (comment.reactions_count >= MIN_REACTIONS_THRESHOLD) {
    score += 20;
  } else if (comment.reactions_count >= 2) {
    score += 10;
  }

  // Length score (25 points max)
  const textLength = comment.text?.length || 0;
  if (textLength >= 50 && textLength <= 500) {
    score += 25; // Good length, thoughtful
  } else if (textLength >= 20 && textLength <= 800) {
    score += 15; // Acceptable length
  } else if (textLength > 0) {
    score += 5;  // Has some text
  }

  // Replies score (20 points max)
  if (comment.replies_count >= 3) {
    score += 20; // Active discussion
  } else if (comment.replies_count >= 1) {
    score += 10; // Some engagement
  }

  // Text quality score (25 points max)
  const text = comment.text?.toLowerCase() || '';
  // Penalize spam-like content
  if (text.includes('check out my') || text.includes('dm me') || text.includes('link in bio')) {
    score -= 20;
  }
  // Reward substantive content
  if (text.includes('agree') || text.includes('great point') || text.includes('interesting') ||
      text.includes('question') || text.includes('experience') || text.includes('perspective')) {
    score += 15;
  }
  // Reward longer, thoughtful comments
  if (textLength >= 100 && !text.includes('http')) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Find the best quality comment to reply to
 *
 * @param comments - Array of comments
 * @returns Best comment or null if none meet threshold
 */
export function findBestCommentToReply(comments: LinkedInComment[]): QualityComment | null {
  if (!comments || comments.length === 0) {
    return null;
  }

  // Score all comments
  const scoredComments: QualityComment[] = comments.map(comment => ({
    ...comment,
    quality_score: scoreCommentQuality(comment)
  }));

  // Filter by minimum threshold (must have 5+ reactions)
  const qualityComments = scoredComments.filter(c =>
    c.reactions_count >= MIN_REACTIONS_THRESHOLD && c.quality_score >= 40
  );

  if (qualityComments.length === 0) {
    return null;
  }

  // Sort by score descending
  qualityComments.sort((a, b) => b.quality_score - a.quality_score);

  // Return the best one
  return qualityComments[0];
}

/**
 * Decide whether to reply to a comment or comment on the post
 *
 * Uses 70/30 split: 70% post comments, 30% comment replies
 * Only replies if a quality comment exists
 *
 * @param comments - Array of comments on the post
 * @returns { shouldReply: boolean, targetComment: QualityComment | null }
 */
export function shouldReplyToComment(comments: LinkedInComment[]): {
  shouldReply: boolean;
  targetComment: QualityComment | null;
  reason: string;
} {
  // Random chance: 70% post comment, 30% reply
  const random = Math.random();
  if (random > REPLY_PROBABILITY) {
    return {
      shouldReply: false,
      targetComment: null,
      reason: `Random selection chose post comment (${(random * 100).toFixed(0)}% > ${REPLY_PROBABILITY * 100}%)`
    };
  }

  // Find best quality comment
  const bestComment = findBestCommentToReply(comments);

  if (!bestComment) {
    return {
      shouldReply: false,
      targetComment: null,
      reason: 'No quality comments found (need 5+ reactions and score >= 40)'
    };
  }

  return {
    shouldReply: true,
    targetComment: bestComment,
    reason: `Found quality comment by ${bestComment.author_name} (score: ${bestComment.quality_score}, reactions: ${bestComment.reactions_count})`
  };
}

/**
 * Generate context for replying to a comment
 * This will be used by the AI to generate the reply
 */
export interface CommentReplyContext {
  originalPostText: string;
  commentAuthorName: string;
  commentText: string;
  commentReactionsCount: number;
}

export function buildCommentReplyContext(
  postContent: string,
  targetComment: QualityComment
): CommentReplyContext {
  return {
    originalPostText: postContent || '',
    commentAuthorName: targetComment.author_name,
    commentText: targetComment.text,
    commentReactionsCount: targetComment.reactions_count
  };
}
