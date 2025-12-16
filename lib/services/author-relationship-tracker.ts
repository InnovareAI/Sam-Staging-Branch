/**
 * Author Relationship Tracker
 *
 * Tracks interaction history with LinkedIn authors to:
 * 1. Build stronger relationships over time
 * 2. Avoid repeating same topics
 * 3. Prioritize authors who engage back
 * 4. Personalize comments based on history
 *
 * Created: December 16, 2025
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AuthorRelationship {
  id?: string;
  workspace_id: string;
  author_profile_id: string;
  author_name?: string;
  author_headline?: string;
  author_company?: string;

  // Interaction metrics
  total_comments_made: number;
  total_replies_received: number;
  total_likes_received: number;
  author_responded_count: number;

  // Performance
  avg_performance_score?: number;
  best_performing_topic?: string;

  // Timing
  first_interaction_at?: string;
  last_interaction_at?: string;
  last_comment_at?: string;

  // Status
  relationship_strength: 'new' | 'engaged' | 'responsive' | 'advocate';

  // Topics (for variety)
  topics_discussed: string[];

  notes?: string;
}

export interface RelationshipContext {
  exists: boolean;
  relationship?: AuthorRelationship;
  recommendation: 'comment' | 'skip_cooldown' | 'high_priority';
  reason: string;
  suggested_approach?: string;
  topics_to_avoid?: string[];
}

/**
 * Get relationship context for an author before commenting
 */
export async function getAuthorRelationshipContext(
  supabase: SupabaseClient,
  workspaceId: string,
  authorProfileId: string,
  authorName?: string
): Promise<RelationshipContext> {
  // Try to find existing relationship
  const { data: relationship, error } = await supabase
    .from('linkedin_author_relationships')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('author_profile_id', authorProfileId)
    .single();

  if (error && error.code !== 'PGRST116') {  // Not "no rows"
    console.error('Error fetching author relationship:', error);
  }

  if (!relationship) {
    // New author - check if we've recently commented
    const recentComment = await checkRecentComment(supabase, workspaceId, authorProfileId, authorName);
    if (recentComment) {
      return {
        exists: false,
        recommendation: 'skip_cooldown',
        reason: `Commented on this author ${recentComment.daysAgo} days ago`,
      };
    }

    return {
      exists: false,
      recommendation: 'comment',
      reason: 'New author - first interaction opportunity',
      suggested_approach: 'Be especially thoughtful and value-focused for first impression',
    };
  }

  // Existing relationship - analyze and recommend
  return analyzeRelationship(relationship);
}

/**
 * Check if we've commented on this author recently
 */
async function checkRecentComment(
  supabase: SupabaseClient,
  workspaceId: string,
  authorProfileId: string,
  authorName?: string
): Promise<{ daysAgo: number } | null> {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  // Check by author_profile_id via post join
  const { data: recentComments } = await supabase
    .from('linkedin_post_comments')
    .select(`
      id,
      posted_at,
      post:linkedin_posts_discovered!inner(author_profile_id, author_name)
    `)
    .eq('workspace_id', workspaceId)
    .gte('posted_at', fiveDaysAgo.toISOString())
    .limit(10);

  if (!recentComments) return null;

  for (const comment of recentComments) {
    const post = comment.post as any;
    if (post?.author_profile_id === authorProfileId ||
        (authorName && post?.author_name === authorName)) {
      const postedAt = new Date(comment.posted_at);
      const daysAgo = Math.floor((Date.now() - postedAt.getTime()) / (1000 * 60 * 60 * 24));
      return { daysAgo };
    }
  }

  return null;
}

/**
 * Analyze existing relationship and provide recommendation
 */
function analyzeRelationship(relationship: AuthorRelationship): RelationshipContext {
  const daysSinceLastInteraction = relationship.last_interaction_at
    ? Math.floor((Date.now() - new Date(relationship.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Cooldown check (5 days)
  if (daysSinceLastInteraction < 5) {
    return {
      exists: true,
      relationship,
      recommendation: 'skip_cooldown',
      reason: `Last interaction was ${daysSinceLastInteraction} days ago (5-day cooldown)`,
    };
  }

  // Advocate or responsive author - high priority
  if (relationship.relationship_strength === 'advocate' ||
      relationship.relationship_strength === 'responsive') {
    return {
      exists: true,
      relationship,
      recommendation: 'high_priority',
      reason: `${relationship.author_name} has engaged with us before (${relationship.relationship_strength})`,
      suggested_approach: buildPersonalizedApproach(relationship),
      topics_to_avoid: relationship.topics_discussed?.slice(-3) || [],  // Avoid last 3 topics
    };
  }

  // Engaged author - normal priority
  if (relationship.relationship_strength === 'engaged') {
    return {
      exists: true,
      relationship,
      recommendation: 'comment',
      reason: `Building relationship with ${relationship.author_name} (${relationship.total_comments_made} prior interactions)`,
      suggested_approach: 'Reference past engagement subtly if relevant',
      topics_to_avoid: relationship.topics_discussed?.slice(-2) || [],
    };
  }

  // Default - proceed with comment
  return {
    exists: true,
    relationship,
    recommendation: 'comment',
    reason: 'Continuing to build relationship',
    topics_to_avoid: relationship.topics_discussed?.slice(-1) || [],
  };
}

/**
 * Build personalized approach suggestion based on history
 */
function buildPersonalizedApproach(relationship: AuthorRelationship): string {
  const approaches: string[] = [];

  if (relationship.author_responded_count > 0) {
    approaches.push('They\'ve replied to you before - reference past conversation if relevant');
  }

  if (relationship.best_performing_topic) {
    approaches.push(`Best engagement on topic: "${relationship.best_performing_topic}"`);
  }

  if (relationship.total_likes_received > 0) {
    approaches.push('They\'ve liked your comments - continue value-focused approach');
  }

  if (approaches.length === 0) {
    approaches.push('Continue building relationship with thoughtful, specific comments');
  }

  return approaches.join('. ');
}

/**
 * Record a new interaction with an author
 */
export async function recordAuthorInteraction(
  supabase: SupabaseClient,
  workspaceId: string,
  authorProfileId: string,
  interaction: {
    author_name?: string;
    author_headline?: string;
    topic?: string;
    comment_id: string;
    performance_score?: number;
  }
): Promise<boolean> {
  // Get or create relationship record
  const { data: existing } = await supabase
    .from('linkedin_author_relationships')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('author_profile_id', authorProfileId)
    .single();

  const now = new Date().toISOString();

  if (existing) {
    // Update existing
    const topics = existing.topics_discussed || [];
    if (interaction.topic && !topics.includes(interaction.topic)) {
      topics.push(interaction.topic);
    }

    // Calculate new strength
    const newCommentCount = (existing.total_comments_made || 0) + 1;
    const newStrength = calculateRelationshipStrength(
      newCommentCount,
      existing.author_responded_count || 0
    );

    const { error } = await supabase
      .from('linkedin_author_relationships')
      .update({
        author_name: interaction.author_name || existing.author_name,
        author_headline: interaction.author_headline || existing.author_headline,
        total_comments_made: newCommentCount,
        last_interaction_at: now,
        last_comment_at: now,
        topics_discussed: topics.slice(-10),  // Keep last 10 topics
        relationship_strength: newStrength,
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Failed to update author relationship:', error);
      return false;
    }
  } else {
    // Create new
    const { error } = await supabase
      .from('linkedin_author_relationships')
      .insert({
        workspace_id: workspaceId,
        author_profile_id: authorProfileId,
        author_name: interaction.author_name,
        author_headline: interaction.author_headline,
        total_comments_made: 1,
        total_replies_received: 0,
        total_likes_received: 0,
        author_responded_count: 0,
        first_interaction_at: now,
        last_interaction_at: now,
        last_comment_at: now,
        relationship_strength: 'new',
        topics_discussed: interaction.topic ? [interaction.topic] : [],
      });

    if (error) {
      console.error('Failed to create author relationship:', error);
      return false;
    }
  }

  return true;
}

/**
 * Update relationship when author responds to our comment
 */
export async function recordAuthorResponse(
  supabase: SupabaseClient,
  workspaceId: string,
  authorProfileId: string,
  responseType: 'reply' | 'like'
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('linkedin_author_relationships')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('author_profile_id', authorProfileId)
    .single();

  if (!existing) {
    console.warn('No relationship found for author response:', authorProfileId);
    return false;
  }

  const updates: any = {
    last_interaction_at: new Date().toISOString(),
  };

  if (responseType === 'reply') {
    updates.total_replies_received = (existing.total_replies_received || 0) + 1;
    updates.author_responded_count = (existing.author_responded_count || 0) + 1;
  } else if (responseType === 'like') {
    updates.total_likes_received = (existing.total_likes_received || 0) + 1;
  }

  // Recalculate strength
  updates.relationship_strength = calculateRelationshipStrength(
    existing.total_comments_made || 0,
    updates.author_responded_count || existing.author_responded_count || 0
  );

  const { error } = await supabase
    .from('linkedin_author_relationships')
    .update(updates)
    .eq('id', existing.id);

  if (error) {
    console.error('Failed to record author response:', error);
    return false;
  }

  return true;
}

/**
 * Calculate relationship strength based on interactions
 *
 * - new: < 3 total comments
 * - engaged: 3+ comments, no responses
 * - responsive: author has replied at least once
 * - advocate: author has replied 3+ times
 */
function calculateRelationshipStrength(
  totalComments: number,
  authorResponses: number
): 'new' | 'engaged' | 'responsive' | 'advocate' {
  if (authorResponses >= 3) return 'advocate';
  if (authorResponses >= 1) return 'responsive';
  if (totalComments >= 3) return 'engaged';
  return 'new';
}

/**
 * Get top relationships (most engaged authors)
 */
export async function getTopRelationships(
  supabase: SupabaseClient,
  workspaceId: string,
  limit: number = 10
): Promise<AuthorRelationship[]> {
  const { data, error } = await supabase
    .from('linkedin_author_relationships')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('relationship_strength', ['responsive', 'advocate'])
    .order('author_responded_count', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get top relationships:', error);
    return [];
  }

  return data || [];
}

/**
 * Extract likely topic from post content
 */
export function extractTopicFromPost(postContent: string): string | null {
  if (!postContent || postContent.length < 50) return null;

  // Simple topic extraction: find most prominent noun phrases
  const keywords = postContent
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4)  // Only meaningful words
    .filter(word => !STOP_WORDS.has(word));

  // Get most frequent keyword
  const frequency: Record<string, number> = {};
  for (const word of keywords) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  const sorted = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  return sorted.length > 0 ? sorted.join(', ') : null;
}

const STOP_WORDS = new Set([
  'about', 'after', 'being', 'could', 'doing', 'during', 'every',
  'first', 'going', 'great', 'having', 'their', 'there', 'these',
  'thing', 'think', 'those', 'through', 'today', 'using', 'would',
  'years', 'always', 'really', 'people', 'should', 'still', 'world',
]);
