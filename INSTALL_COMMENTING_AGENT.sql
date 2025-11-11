-- =====================================================
-- LinkedIn Commenting Agent - Complete Installation
-- Run this entire file in Supabase SQL Editor
-- =====================================================

-- This combines:
-- 1. Migration 20251030000003_create_linkedin_commenting_agent.sql
-- 2. Migration 20251110_add_commenting_agent_column.sql

-- =====================================================
-- PART 1: Add commenting_agent_enabled to workspaces
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces'
    AND column_name = 'commenting_agent_enabled'
  ) THEN
    ALTER TABLE workspaces
    ADD COLUMN commenting_agent_enabled BOOLEAN DEFAULT FALSE;

    -- Create index for quick feature check
    CREATE INDEX idx_workspaces_commenting_enabled
    ON workspaces(commenting_agent_enabled)
    WHERE commenting_agent_enabled = TRUE;

    RAISE NOTICE 'Added commenting_agent_enabled column to workspaces table';
  ELSE
    RAISE NOTICE 'Column commenting_agent_enabled already exists';
  END IF;
END $$;

-- =====================================================
-- PART 2: Create LinkedIn Commenting Agent Tables
-- =====================================================

-- Table 1: linkedin_post_monitors
CREATE TABLE IF NOT EXISTS linkedin_post_monitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  monitor_type TEXT NOT NULL CHECK (monitor_type IN ('profile', 'keyword', 'hashtag', 'company')),
  target_value TEXT NOT NULL,
  target_metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  check_frequency_minutes INTEGER DEFAULT 30,
  min_engagement_threshold INTEGER DEFAULT 0,
  exclude_keywords TEXT[] DEFAULT '{}',
  prospect_id UUID,
  campaign_id UUID,
  last_checked_at TIMESTAMPTZ,
  posts_discovered_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT linkedin_post_monitors_workspace_target_unique
    UNIQUE(workspace_id, monitor_type, target_value)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_monitors_workspace ON linkedin_post_monitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_monitors_active ON linkedin_post_monitors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_monitors_next_check ON linkedin_post_monitors(last_checked_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_monitors_type ON linkedin_post_monitors(monitor_type);

ALTER TABLE linkedin_post_monitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view monitors for their workspaces" ON linkedin_post_monitors;
CREATE POLICY "Users can view monitors for their workspaces"
  ON linkedin_post_monitors FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage monitors in their workspaces" ON linkedin_post_monitors;
CREATE POLICY "Users can manage monitors in their workspaces"
  ON linkedin_post_monitors FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Table 2: linkedin_posts_discovered
CREATE TABLE IF NOT EXISTS linkedin_posts_discovered (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_linkedin_id TEXT NOT NULL,
  post_url TEXT NOT NULL,
  post_social_id TEXT,
  author_linkedin_id TEXT NOT NULL,
  author_name TEXT,
  author_profile_url TEXT,
  author_title TEXT,
  author_company TEXT,
  post_text TEXT,
  post_type TEXT,
  has_media BOOLEAN DEFAULT false,
  media_urls TEXT[] DEFAULT '{}',
  posted_at TIMESTAMPTZ NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  discovered_via_monitor_id UUID REFERENCES linkedin_post_monitors(id) ON DELETE SET NULL,
  monitor_type TEXT,
  matched_keywords TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'comment_generated', 'commented', 'skipped', 'failed')),
  skip_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_posts_workspace ON linkedin_posts_discovered(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_status ON linkedin_posts_discovered(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_author ON linkedin_posts_discovered(author_linkedin_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_monitor ON linkedin_posts_discovered(discovered_via_monitor_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_posted_at ON linkedin_posts_discovered(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_discovered_at ON linkedin_posts_discovered(discovered_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_posts_linkedin_id_unique ON linkedin_posts_discovered(post_linkedin_id);

ALTER TABLE linkedin_posts_discovered ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view posts for their workspaces" ON linkedin_posts_discovered;
CREATE POLICY "Users can view posts for their workspaces"
  ON linkedin_posts_discovered FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "System can manage posts" ON linkedin_posts_discovered;
CREATE POLICY "System can manage posts"
  ON linkedin_posts_discovered FOR ALL
  USING (true);

-- Table 3: linkedin_comment_queue
CREATE TABLE IF NOT EXISTS linkedin_comment_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES linkedin_posts_discovered(id) ON DELETE CASCADE,
  post_linkedin_id TEXT NOT NULL,
  post_social_id TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  comment_generated_at TIMESTAMPTZ DEFAULT NOW(),
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0.00 AND 1.00),
  generation_metadata JSONB DEFAULT '{}',
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  requires_approval BOOLEAN DEFAULT true,
  auto_post_threshold DECIMAL(3,2) DEFAULT 0.80,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'posting', 'posted', 'failed', 'cancelled')),
  posted_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  unipile_comment_id TEXT,
  unipile_response JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_comments_workspace ON linkedin_comment_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_post ON linkedin_comment_queue(post_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_status ON linkedin_comment_queue(status) WHERE status IN ('queued', 'posting');
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_approval ON linkedin_comment_queue(approval_status, requires_approval) WHERE approval_status = 'pending' AND requires_approval = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_auto_post ON linkedin_comment_queue(status, requires_approval) WHERE status = 'queued' AND requires_approval = false;
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_confidence ON linkedin_comment_queue(confidence_score DESC);

ALTER TABLE linkedin_comment_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comment queue for their workspaces" ON linkedin_comment_queue;
CREATE POLICY "Users can view comment queue for their workspaces"
  ON linkedin_comment_queue FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can approve/reject comments" ON linkedin_comment_queue;
CREATE POLICY "Users can approve/reject comments"
  ON linkedin_comment_queue FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "System can manage comment queue" ON linkedin_comment_queue;
CREATE POLICY "System can manage comment queue"
  ON linkedin_comment_queue FOR ALL
  USING (true);

-- Table 4: linkedin_comments_posted
CREATE TABLE IF NOT EXISTS linkedin_comments_posted (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  comment_queue_id UUID REFERENCES linkedin_comment_queue(id) ON DELETE SET NULL,
  post_id UUID REFERENCES linkedin_posts_discovered(id) ON DELETE SET NULL,
  post_linkedin_id TEXT NOT NULL,
  comment_linkedin_id TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  posted_by_account_id TEXT,
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  last_engagement_check_at TIMESTAMPTZ,
  author_replied BOOLEAN DEFAULT false,
  author_liked BOOLEAN DEFAULT false,
  author_reply_text TEXT,
  author_reply_at TIMESTAMPTZ,
  generated_conversation BOOLEAN DEFAULT false,
  conversation_thread_size INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_posted_workspace ON linkedin_comments_posted(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_date ON linkedin_comments_posted(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_author_response ON linkedin_comments_posted(author_replied) WHERE author_replied = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_post ON linkedin_comments_posted(post_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_comment_queue ON linkedin_comments_posted(comment_queue_id);

ALTER TABLE linkedin_comments_posted ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view posted comments for their workspaces" ON linkedin_comments_posted;
CREATE POLICY "Users can view posted comments for their workspaces"
  ON linkedin_comments_posted FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "System can manage posted comments" ON linkedin_comments_posted;
CREATE POLICY "System can manage posted comments"
  ON linkedin_comments_posted FOR ALL
  USING (true);

-- =====================================================
-- Helper Functions
-- =====================================================

CREATE OR REPLACE FUNCTION check_linkedin_comment_rate_limit(
  p_workspace_id UUID,
  p_period_hours INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
  comments_in_period INTEGER;
  hourly_limit INTEGER := 10;
  daily_limit INTEGER := 50;
  result JSONB;
BEGIN
  SELECT COUNT(*) INTO comments_in_period
  FROM linkedin_comments_posted
  WHERE workspace_id = p_workspace_id
    AND posted_at > NOW() - (p_period_hours || ' hours')::INTERVAL;

  result := jsonb_build_object(
    'within_limits', CASE
      WHEN p_period_hours = 1 THEN comments_in_period < hourly_limit
      WHEN p_period_hours = 24 THEN comments_in_period < daily_limit
      ELSE true
    END,
    'count', comments_in_period,
    'limit', CASE
      WHEN p_period_hours = 1 THEN hourly_limit
      WHEN p_period_hours = 24 THEN daily_limit
      ELSE 0
    END,
    'remaining', CASE
      WHEN p_period_hours = 1 THEN GREATEST(0, hourly_limit - comments_in_period)
      WHEN p_period_hours = 24 THEN GREATEST(0, daily_limit - comments_in_period)
      ELSE 0
    END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_linkedin_commenting_analytics(
  p_workspace_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_comments_posted', COUNT(*)::INTEGER,
    'avg_confidence_score', ROUND(AVG(cq.confidence_score)::NUMERIC, 2),
    'auto_posted_count', COUNT(*) FILTER (WHERE cq.requires_approval = false)::INTEGER,
    'manually_approved_count', COUNT(*) FILTER (WHERE cq.requires_approval = true)::INTEGER,
    'author_replies', COUNT(*) FILTER (WHERE cp.author_replied = true)::INTEGER,
    'author_likes', COUNT(*) FILTER (WHERE cp.author_liked = true)::INTEGER,
    'engagement_rate', ROUND(
      (COUNT(*) FILTER (WHERE cp.author_replied = true OR cp.author_liked = true)::NUMERIC /
       NULLIF(COUNT(*), 0)) * 100, 2
    ),
    'avg_likes_per_comment', ROUND(AVG(cp.likes_count)::NUMERIC, 1),
    'avg_replies_per_comment', ROUND(AVG(cp.replies_count)::NUMERIC, 1)
  )
  INTO result
  FROM linkedin_comments_posted cp
  JOIN linkedin_comment_queue cq ON cp.comment_queue_id = cq.id
  WHERE cp.workspace_id = p_workspace_id
    AND cp.posted_at > NOW() - (p_days || ' days')::INTERVAL;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_linkedin_commenting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS linkedin_monitors_updated_at ON linkedin_post_monitors;
CREATE TRIGGER linkedin_monitors_updated_at
  BEFORE UPDATE ON linkedin_post_monitors
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_commenting_updated_at();

DROP TRIGGER IF EXISTS linkedin_posts_updated_at ON linkedin_posts_discovered;
CREATE TRIGGER linkedin_posts_updated_at
  BEFORE UPDATE ON linkedin_posts_discovered
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_commenting_updated_at();

DROP TRIGGER IF EXISTS linkedin_comment_queue_updated_at ON linkedin_comment_queue;
CREATE TRIGGER linkedin_comment_queue_updated_at
  BEFORE UPDATE ON linkedin_comment_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_commenting_updated_at();

DROP TRIGGER IF EXISTS linkedin_comments_posted_updated_at ON linkedin_comments_posted;
CREATE TRIGGER linkedin_comments_posted_updated_at
  BEFORE UPDATE ON linkedin_comments_posted
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_commenting_updated_at();

-- =====================================================
-- Table Comments
-- =====================================================

COMMENT ON TABLE linkedin_post_monitors IS 'Defines what LinkedIn posts to monitor per workspace (profiles, keywords, hashtags, companies)';
COMMENT ON TABLE linkedin_posts_discovered IS 'Discovered LinkedIn posts ready for commenting';
COMMENT ON TABLE linkedin_comment_queue IS 'AI-generated comments awaiting approval or auto-posting';
COMMENT ON TABLE linkedin_comments_posted IS 'Posted comments with engagement tracking';

-- =====================================================
-- Verification
-- =====================================================

-- Check if tables were created
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN (
  'linkedin_post_monitors',
  'linkedin_posts_discovered',
  'linkedin_comment_queue',
  'linkedin_comments_posted'
)
ORDER BY table_name;

-- Check if commenting_agent_enabled column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'workspaces'
  AND column_name = 'commenting_agent_enabled';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ LinkedIn Commenting Agent installation complete!';
  RAISE NOTICE '📊 4 tables created: linkedin_post_monitors, linkedin_posts_discovered, linkedin_comment_queue, linkedin_comments_posted';
  RAISE NOTICE '🔧 2 helper functions created: check_linkedin_comment_rate_limit, get_linkedin_commenting_analytics';
  RAISE NOTICE '🔒 Row Level Security enabled on all tables';
  RAISE NOTICE '🎯 Next step: Enable for a workspace by setting commenting_agent_enabled = true';
END $$;
