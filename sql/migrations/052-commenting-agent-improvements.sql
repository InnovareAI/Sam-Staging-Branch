-- Migration: Commenting Agent Improvements
-- Created: December 16, 2025
-- Features:
--   1. Engagement quality scoring for post selection
--   2. Comment performance tracking (actual engagement on our comments)
--   3. Relationship memory for author interactions

-- ============================================
-- 1. ENGAGEMENT QUALITY SCORING
-- Add quality score columns to discovered posts
-- ============================================

-- Add engagement quality score to discovered posts
ALTER TABLE linkedin_posts_discovered
ADD COLUMN IF NOT EXISTS engagement_quality_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS quality_factors JSONB DEFAULT '{}';

-- Index for efficient quality-based sorting
CREATE INDEX IF NOT EXISTS idx_posts_quality_score
  ON linkedin_posts_discovered(workspace_id, engagement_quality_score DESC)
  WHERE status = 'discovered';

COMMENT ON COLUMN linkedin_posts_discovered.engagement_quality_score IS 'Calculated score 0-100 based on engagement signals';
COMMENT ON COLUMN linkedin_posts_discovered.quality_factors IS 'Breakdown: {author_score, engagement_ratio, recency_bonus, comment_ratio}';

-- ============================================
-- 2. COMMENT PERFORMANCE TRACKING
-- Track actual engagement on our posted comments
-- ============================================

-- Add performance tracking columns to comments
ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS reactions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replies_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS performance_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS last_engagement_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS author_replied BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS author_liked BOOLEAN DEFAULT FALSE;

-- Index for performance analysis
CREATE INDEX IF NOT EXISTS idx_comments_performance
  ON linkedin_post_comments(workspace_id, performance_score DESC)
  WHERE status = 'posted';

COMMENT ON COLUMN linkedin_post_comments.reactions_count IS 'Number of likes/reactions on our comment';
COMMENT ON COLUMN linkedin_post_comments.replies_count IS 'Number of replies to our comment';
COMMENT ON COLUMN linkedin_post_comments.performance_score IS 'Calculated score based on engagement received';
COMMENT ON COLUMN linkedin_post_comments.author_replied IS 'Did the post author reply to our comment?';
COMMENT ON COLUMN linkedin_post_comments.author_liked IS 'Did the post author like our comment?';

-- ============================================
-- 3. RELATIONSHIP MEMORY
-- Track interactions with authors over time
-- ============================================

CREATE TABLE IF NOT EXISTS linkedin_author_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Author identification
  author_profile_id TEXT NOT NULL,
  author_name TEXT,
  author_headline TEXT,
  author_company TEXT,

  -- Interaction counts
  total_comments_made INTEGER DEFAULT 0,
  total_replies_received INTEGER DEFAULT 0,
  total_likes_received INTEGER DEFAULT 0,
  author_responded_count INTEGER DEFAULT 0,  -- Times they replied to us

  -- Engagement quality
  avg_performance_score DECIMAL(5,2),
  best_performing_topic TEXT,

  -- Timing
  first_interaction_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  last_comment_at TIMESTAMPTZ,

  -- Relationship status
  relationship_strength TEXT DEFAULT 'new' CHECK (relationship_strength IN ('new', 'engaged', 'responsive', 'advocate')),
  -- new: < 3 interactions
  -- engaged: 3+ interactions
  -- responsive: they've replied to us
  -- advocate: they've replied multiple times

  -- Topics we've discussed (for variety)
  topics_discussed JSONB DEFAULT '[]',

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, author_profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_author_relationships_workspace
  ON linkedin_author_relationships(workspace_id);

CREATE INDEX IF NOT EXISTS idx_author_relationships_last_interaction
  ON linkedin_author_relationships(workspace_id, last_interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_author_relationships_strength
  ON linkedin_author_relationships(workspace_id, relationship_strength);

-- RLS Policies
ALTER TABLE linkedin_author_relationships ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages author relationships"
  ON linkedin_author_relationships
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Workspace members can view
CREATE POLICY "Workspace members view author relationships"
  ON linkedin_author_relationships
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Update trigger
CREATE OR REPLACE FUNCTION update_author_relationship_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS author_relationships_updated_at ON linkedin_author_relationships;
CREATE TRIGGER author_relationships_updated_at
  BEFORE UPDATE ON linkedin_author_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_author_relationship_timestamp();

-- ============================================
-- 4. COMMENT PERFORMANCE AGGREGATES TABLE
-- For learning what comment styles work best
-- ============================================

CREATE TABLE IF NOT EXISTS linkedin_comment_performance_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Volume metrics
  total_comments INTEGER DEFAULT 0,
  total_posted INTEGER DEFAULT 0,
  total_with_engagement INTEGER DEFAULT 0,

  -- Engagement metrics
  total_reactions INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  author_response_rate DECIMAL(5,2),

  -- Performance by comment type
  performance_by_type JSONB DEFAULT '{}',
  -- {question: {count, avg_reactions}, statement: {...}, story: {...}}

  -- Performance by length
  performance_by_length JSONB DEFAULT '{}',
  -- {short: {count, avg_reactions}, medium: {...}, long: {...}}

  -- Best performing openers (learned from data)
  top_openers JSONB DEFAULT '[]',

  -- Topics that work well
  top_topics JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id, period_start, period_end)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_comment_performance_stats_workspace
  ON linkedin_comment_performance_stats(workspace_id, period_start DESC);

-- RLS
ALTER TABLE linkedin_comment_performance_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages performance stats"
  ON linkedin_comment_performance_stats
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Workspace members view performance stats"
  ON linkedin_comment_performance_stats
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE linkedin_author_relationships IS 'Tracks interaction history with LinkedIn authors for relationship building';
COMMENT ON TABLE linkedin_comment_performance_stats IS 'Aggregated performance metrics to learn what comment styles work best';
