/**
 * Engagement Quality Scorer
 *
 * Calculates a quality score (0-100) for LinkedIn posts to prioritize
 * which posts are most worth commenting on.
 *
 * Factors:
 * - Author engagement ratio (reactions per post)
 * - Comment-to-like ratio (high = active discussion)
 * - Post recency (fresh posts get bonus)
 * - Post length (substantial content)
 * - Author follower influence (if available)
 *
 * Created: December 16, 2025
 */

export interface EngagementMetrics {
  likes_count: number;
  comments_count: number;
  shares_count?: number;
  reposts?: number;
}

export interface PostForScoring {
  post_content: string;
  engagement_metrics: EngagementMetrics;
  post_date: string | Date;
  author_name?: string;
  author_headline?: string;
}

export interface QualityScore {
  total_score: number;  // 0-100
  factors: {
    engagement_score: number;      // 0-30 based on total engagement
    discussion_score: number;      // 0-25 based on comment-to-like ratio
    recency_score: number;         // 0-20 based on post age
    content_depth_score: number;   // 0-15 based on post length/substance
    author_quality_score: number;  // 0-10 based on author signals
  };
  recommendation: 'high_priority' | 'normal' | 'low_priority' | 'skip';
}

/**
 * Calculate engagement quality score for a post
 */
export function calculateEngagementQuality(post: PostForScoring): QualityScore {
  const factors = {
    engagement_score: calculateEngagementScore(post.engagement_metrics),
    discussion_score: calculateDiscussionScore(post.engagement_metrics),
    recency_score: calculateRecencyScore(post.post_date),
    content_depth_score: calculateContentDepthScore(post.post_content),
    author_quality_score: calculateAuthorQualityScore(post.author_headline),
  };

  const total_score = Object.values(factors).reduce((sum, score) => sum + score, 0);

  return {
    total_score: Math.round(total_score * 10) / 10,
    factors,
    recommendation: getRecommendation(total_score),
  };
}

/**
 * Engagement Score (0-30)
 * Based on total engagement (likes + comments + shares)
 *
 * Scale:
 * - 0-10 engagement: 0-10 points
 * - 10-50 engagement: 10-20 points
 * - 50-200 engagement: 20-25 points
 * - 200+ engagement: 25-30 points
 */
function calculateEngagementScore(metrics: EngagementMetrics): number {
  const total = (metrics.likes_count || 0) +
                (metrics.comments_count || 0) +
                (metrics.shares_count || metrics.reposts || 0);

  if (total === 0) return 0;
  if (total < 3) return 2;  // Very low engagement
  if (total < 10) return 5 + (total / 10) * 5;  // 5-10 points
  if (total < 50) return 10 + ((total - 10) / 40) * 10;  // 10-20 points
  if (total < 200) return 20 + ((total - 50) / 150) * 5;  // 20-25 points
  return Math.min(30, 25 + Math.log10(total - 200) * 2);  // 25-30 points
}

/**
 * Discussion Score (0-25)
 * High comment-to-like ratio = active discussion = good opportunity
 *
 * Ideal ratio: 0.1-0.3 (10-30 comments per 100 likes)
 * This indicates genuine engagement, not just passive scrolling
 */
function calculateDiscussionScore(metrics: EngagementMetrics): number {
  const likes = metrics.likes_count || 0;
  const comments = metrics.comments_count || 0;

  if (likes === 0 && comments === 0) return 0;
  if (likes === 0) return comments > 0 ? 15 : 0;  // Comments with no likes = engaged post

  const ratio = comments / likes;

  // Optimal ratio is 0.15-0.25 (15-25 comments per 100 likes)
  if (ratio >= 0.15 && ratio <= 0.30) return 25;  // Optimal
  if (ratio >= 0.10 && ratio < 0.15) return 20;   // Good
  if (ratio >= 0.30 && ratio <= 0.50) return 20;  // High discussion
  if (ratio >= 0.05 && ratio < 0.10) return 15;   // Moderate
  if (ratio > 0.50) return 15;                     // Very high (might be controversial)
  if (ratio >= 0.02 && ratio < 0.05) return 10;   // Low discussion
  return 5;  // Very low discussion ratio
}

/**
 * Recency Score (0-20)
 * Fresher posts are better for engagement
 *
 * Scale:
 * - 0-4 hours: 20 points (hot)
 * - 4-12 hours: 18 points
 * - 12-24 hours: 15 points
 * - 1-2 days: 12 points
 * - 2-4 days: 8 points
 * - 4-7 days: 5 points
 * - 7+ days: 2 points
 */
function calculateRecencyScore(postDate: string | Date): number {
  const now = new Date();
  const posted = new Date(postDate);
  const hoursAgo = (now.getTime() - posted.getTime()) / (1000 * 60 * 60);

  if (hoursAgo < 4) return 20;      // Hot
  if (hoursAgo < 12) return 18;     // Very fresh
  if (hoursAgo < 24) return 15;     // Fresh
  if (hoursAgo < 48) return 12;     // 1-2 days
  if (hoursAgo < 96) return 8;      // 2-4 days
  if (hoursAgo < 168) return 5;     // 4-7 days
  return 2;                          // Old post
}

/**
 * Content Depth Score (0-15)
 * Longer, more substantial posts offer more to comment on
 *
 * Scale:
 * - < 100 chars: 3 points (too short)
 * - 100-300 chars: 8 points (brief)
 * - 300-800 chars: 15 points (optimal)
 * - 800-1500 chars: 12 points (long)
 * - 1500+ chars: 10 points (very long - harder to comment specifically)
 */
function calculateContentDepthScore(content: string): number {
  const length = content?.trim().length || 0;

  if (length < 50) return 1;       // Too short
  if (length < 100) return 3;      // Very brief
  if (length < 200) return 6;      // Brief
  if (length < 300) return 10;     // Short but substantive
  if (length < 500) return 15;     // Optimal
  if (length < 800) return 14;     // Good length
  if (length < 1200) return 12;    // Long
  if (length < 1500) return 10;    // Very long
  return 8;                         // Essay length
}

/**
 * Author Quality Score (0-10)
 * Based on signals from author headline
 *
 * Positive signals:
 * - Leadership titles (CEO, Founder, VP, Director)
 * - Relevant industries
 * - Company mentions
 */
function calculateAuthorQualityScore(headline?: string): number {
  if (!headline) return 5;  // Unknown = average

  const headlineLower = headline.toLowerCase();
  let score = 5;  // Base score

  // Leadership titles (+3)
  const leadershipTitles = ['ceo', 'founder', 'co-founder', 'cto', 'cmo', 'coo', 'vp', 'vice president', 'director', 'head of', 'partner'];
  if (leadershipTitles.some(title => headlineLower.includes(title))) {
    score += 3;
  }

  // Thought leadership signals (+2)
  const thoughtLeadership = ['author', 'speaker', 'advisor', 'board member', 'investor', 'entrepreneur'];
  if (thoughtLeadership.some(signal => headlineLower.includes(signal))) {
    score += 2;
  }

  // Negative signals (-2)
  const negativeSignals = ['looking for', 'seeking', 'student', 'intern', 'assistant'];
  if (negativeSignals.some(signal => headlineLower.includes(signal))) {
    score -= 2;
  }

  return Math.max(0, Math.min(10, score));
}

/**
 * Get recommendation based on total score
 */
function getRecommendation(score: number): 'high_priority' | 'normal' | 'low_priority' | 'skip' {
  if (score >= 70) return 'high_priority';
  if (score >= 45) return 'normal';
  if (score >= 25) return 'low_priority';
  return 'skip';
}

/**
 * Batch score multiple posts and sort by quality
 */
export function rankPostsByQuality(posts: PostForScoring[]): Array<PostForScoring & { quality: QualityScore }> {
  return posts
    .map(post => ({
      ...post,
      quality: calculateEngagementQuality(post),
    }))
    .sort((a, b) => b.quality.total_score - a.quality.total_score);
}

/**
 * Filter posts to only high-quality ones
 */
export function filterHighQualityPosts(
  posts: PostForScoring[],
  minScore: number = 40
): Array<PostForScoring & { quality: QualityScore }> {
  return rankPostsByQuality(posts).filter(p => p.quality.total_score >= minScore);
}
