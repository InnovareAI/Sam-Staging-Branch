-- =====================================================
-- LinkedIn Commenting Agent
-- Automated engagement via intelligent commenting
-- Created: October 30, 2025
-- =====================================================

-- ===========================================
-- Table 1: linkedin_post_monitors
-- Defines what to monitor for each workspace
-- ===========================================

CREATE TABLE IF NOT EXISTS linkedin_post_monitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Monitor type: 'profile', 'keyword', 'hashtag', 'company'
  monitor_type TEXT NOT NULL CHECK (monitor_type IN ('profile', 'keyword', 'hashtag', 'company')),

  -- Monitor target (depends on type)
  target_value TEXT NOT NULL, -- LinkedIn URL, keyword string, hashtag, company page URL
  target_metadata JSONB DEFAULT '{}', -- { linkedin_id, name, profile_url, etc. }

  -- Monitoring settings
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5), -- 1-5, higher = more important
  check_frequency_minutes INTEGER DEFAULT 30, -- How often to check

  -- Filtering
  min_engagement_threshold INTEGER DEFAULT 0, -- Minimum likes/comments to consider
  exclude_keywords TEXT[] DEFAULT '{}', -- Filter out posts with these words

  -- Association
  prospect_id UUID, -- If monitoring specific prospect
  campaign_id UUID, -- If part of campaign strategy

  -- Metadata
  last_checked_at TIMESTAMPTZ,
  posts_discovered_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure no duplicate monitors
  CONSTRAINT linkedin_post_monitors_workspace_target_unique
    UNIQUE(workspace_id, monitor_type, target_value)
);

-- Indexes for linkedin_post_monitors
CREATE INDEX IF NOT EXISTS idx_linkedin_monitors_workspace ON linkedin_post_monitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_monitors_active ON linkedin_post_monitors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_monitors_next_check
  ON linkedin_post_monitors(last_checked_at)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_monitors_type ON linkedin_post_monitors(monitor_type);

-- RLS policies for linkedin_post_monitors
ALTER TABLE linkedin_post_monitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view monitors for their workspaces" ON linkedin_post_monitors;
CREATE POLICY "Users can view monitors for their workspaces"
  ON linkedin_post_monitors
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage monitors in their workspaces" ON linkedin_post_monitors;
CREATE POLICY "Users can manage monitors in their workspaces"
  ON linkedin_post_monitors
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ===========================================
-- Table 2: linkedin_posts_discovered
-- Stores discovered posts (deduplicated)
-- ===========================================

CREATE TABLE IF NOT EXISTS linkedin_posts_discovered (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Post identification
  post_linkedin_id TEXT NOT NULL, -- urn:li:activity:123
  post_url TEXT NOT NULL,
  post_social_id TEXT, -- Unipile social_id for interactions

  -- Post content
  author_linkedin_id TEXT NOT NULL,
  author_name TEXT,
  author_profile_url TEXT,
  author_title TEXT,
  author_company TEXT,

  post_text TEXT,
  post_type TEXT, -- 'text', 'image', 'video', 'article', 'poll'
  has_media BOOLEAN DEFAULT false,
  media_urls TEXT[] DEFAULT '{}',

  -- Post metadata
  posted_at TIMESTAMPTZ NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Engagement metrics (at discovery time)
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,

  -- Discovery context
  discovered_via_monitor_id UUID REFERENCES linkedin_post_monitors(id) ON DELETE SET NULL,
  monitor_type TEXT, -- Copy of monitor type for quick filtering
  matched_keywords TEXT[] DEFAULT '{}', -- Which keywords triggered discovery

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'comment_generated', 'commented', 'skipped', 'failed')),
  skip_reason TEXT, -- Why we're not commenting (low quality, off-topic, etc.)

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for linkedin_posts_discovered
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_workspace ON linkedin_posts_discovered(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_status ON linkedin_posts_discovered(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_author ON linkedin_posts_discovered(author_linkedin_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_monitor ON linkedin_posts_discovered(discovered_via_monitor_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_posted_at ON linkedin_posts_discovered(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_discovered_at ON linkedin_posts_discovered(discovered_at DESC);

-- Ensure no duplicate posts globally
CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_posts_linkedin_id_unique ON linkedin_posts_discovered(post_linkedin_id);

-- RLS policies for linkedin_posts_discovered
ALTER TABLE linkedin_posts_discovered ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view posts for their workspaces" ON linkedin_posts_discovered;
CREATE POLICY "Users can view posts for their workspaces"
  ON linkedin_posts_discovered
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can manage posts" ON linkedin_posts_discovered;
CREATE POLICY "System can manage posts"
  ON linkedin_posts_discovered
  FOR ALL
  USING (true); -- Allow N8N/automation to insert

-- ===========================================
-- Table 3: linkedin_comment_queue
-- AI-generated comments awaiting approval or auto-posting
-- ===========================================

CREATE TABLE IF NOT EXISTS linkedin_comment_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Post reference
  post_id UUID NOT NULL REFERENCES linkedin_posts_discovered(id) ON DELETE CASCADE,
  post_linkedin_id TEXT NOT NULL,
  post_social_id TEXT NOT NULL, -- For Unipile API

  -- Generated comment
  comment_text TEXT NOT NULL,
  comment_generated_at TIMESTAMPTZ DEFAULT NOW(),

  -- AI metadata
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score BETWEEN 0.00 AND 1.00),
  generation_metadata JSONB DEFAULT '{}', -- { model, tokens_used, reasoning, etc. }

  -- Approval workflow
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Auto-post decision
  requires_approval BOOLEAN DEFAULT true, -- false if confidence > threshold
  auto_post_threshold DECIMAL(3,2) DEFAULT 0.80,

  -- Posting status
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'posting', 'posted', 'failed', 'cancelled')),
  posted_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- Unipile response
  unipile_comment_id TEXT, -- Comment ID from Unipile
  unipile_response JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for linkedin_comment_queue
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_workspace ON linkedin_comment_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_post ON linkedin_comment_queue(post_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_status ON linkedin_comment_queue(status) WHERE status IN ('queued', 'posting');
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_approval
  ON linkedin_comment_queue(approval_status, requires_approval)
  WHERE approval_status = 'pending' AND requires_approval = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_auto_post
  ON linkedin_comment_queue(status, requires_approval)
  WHERE status = 'queued' AND requires_approval = false;
CREATE INDEX IF NOT EXISTS idx_linkedin_comments_confidence ON linkedin_comment_queue(confidence_score DESC);

-- RLS policies for linkedin_comment_queue
ALTER TABLE linkedin_comment_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comment queue for their workspaces" ON linkedin_comment_queue;
CREATE POLICY "Users can view comment queue for their workspaces"
  ON linkedin_comment_queue
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can approve/reject comments" ON linkedin_comment_queue;
CREATE POLICY "Users can approve/reject comments"
  ON linkedin_comment_queue
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can manage comment queue" ON linkedin_comment_queue;
CREATE POLICY "System can manage comment queue"
  ON linkedin_comment_queue
  FOR ALL
  USING (true); -- Allow N8N/automation

-- ===========================================
-- Table 4: linkedin_comments_posted
-- Tracking table for posted comments and engagement
-- ===========================================

CREATE TABLE IF NOT EXISTS linkedin_comments_posted (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- References
  comment_queue_id UUID REFERENCES linkedin_comment_queue(id) ON DELETE SET NULL,
  post_id UUID REFERENCES linkedin_posts_discovered(id) ON DELETE SET NULL,

  -- IDs
  post_linkedin_id TEXT NOT NULL,
  comment_linkedin_id TEXT NOT NULL, -- From Unipile response

  -- Content
  comment_text TEXT NOT NULL,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  posted_by_account_id TEXT, -- Which LinkedIn account posted

  -- Engagement tracking
  likes_count INTEGER DEFAULT 0,
  replies_count INTEGER DEFAULT 0,
  last_engagement_check_at TIMESTAMPTZ,

  -- Author response tracking
  author_replied BOOLEAN DEFAULT false,
  author_liked BOOLEAN DEFAULT false,
  author_reply_text TEXT,
  author_reply_at TIMESTAMPTZ,

  -- Performance
  generated_conversation BOOLEAN DEFAULT false, -- Did our comment spark discussion?
  conversation_thread_size INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for linkedin_comments_posted
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_workspace ON linkedin_comments_posted(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_date ON linkedin_comments_posted(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_author_response
  ON linkedin_comments_posted(author_replied)
  WHERE author_replied = true;
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_post ON linkedin_comments_posted(post_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posted_comment_queue ON linkedin_comments_posted(comment_queue_id);

-- RLS policies for linkedin_comments_posted
ALTER TABLE linkedin_comments_posted ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view posted comments for their workspaces" ON linkedin_comments_posted;
CREATE POLICY "Users can view posted comments for their workspaces"
  ON linkedin_comments_posted
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can manage posted comments" ON linkedin_comments_posted;
CREATE POLICY "System can manage posted comments"
  ON linkedin_comments_posted
  FOR ALL
  USING (true); -- Allow N8N/automation

-- ===========================================
-- Helper Functions
-- ===========================================

-- Function to check rate limits
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
  -- Count comments in the last N hours
  SELECT COUNT(*)
  INTO comments_in_period
  FROM linkedin_comments_posted
  WHERE workspace_id = p_workspace_id
    AND posted_at > NOW() - (p_period_hours || ' hours')::INTERVAL;

  -- Build result
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

COMMENT ON FUNCTION check_linkedin_comment_rate_limit IS 'Check if workspace is within rate limits for LinkedIn commenting';

-- Function to get analytics
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

COMMENT ON FUNCTION get_linkedin_commenting_analytics IS 'Get commenting performance analytics for workspace';

-- ===========================================
-- Triggers for updated_at
-- ===========================================

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

-- ===========================================
-- Comments
-- ===========================================

COMMENT ON TABLE linkedin_post_monitors IS 'Defines what LinkedIn posts to monitor per workspace (profiles, keywords, hashtags, companies)';
COMMENT ON TABLE linkedin_posts_discovered IS 'Discovered LinkedIn posts ready for commenting';
COMMENT ON TABLE linkedin_comment_queue IS 'AI-generated comments awaiting approval or auto-posting';
COMMENT ON TABLE linkedin_comments_posted IS 'Posted comments with engagement tracking';

COMMENT ON COLUMN linkedin_post_monitors.monitor_type IS 'Type: profile, keyword, hashtag, company';
COMMENT ON COLUMN linkedin_post_monitors.priority IS '1-5, higher priority posts get commented on first';

COMMENT ON COLUMN linkedin_posts_discovered.status IS 'pending, comment_generated, commented, skipped, failed';
COMMENT ON COLUMN linkedin_posts_discovered.post_social_id IS 'Unipile social_id format: urn:li:activity:[ID]';

COMMENT ON COLUMN linkedin_comment_queue.confidence_score IS '0.00-1.00, higher = better quality comment';
COMMENT ON COLUMN linkedin_comment_queue.requires_approval IS 'false if confidence >= auto_post_threshold';
COMMENT ON COLUMN linkedin_comment_queue.status IS 'queued, posting, posted, failed, cancelled';

-- ===========================================
-- Sample Data (Optional - Remove in production)
-- ===========================================

-- Example: Monitor a prospect's profile
-- INSERT INTO linkedin_post_monitors (workspace_id, monitor_type, target_value, priority, prospect_id)
-- VALUES (
--   'your-workspace-id',
--   'profile',
--   'https://linkedin.com/in/john-doe',
--   5,
--   'prospect-id'
-- );

-- Example: Monitor keyword
-- INSERT INTO linkedin_post_monitors (workspace_id, monitor_type, target_value, check_frequency_minutes)
-- VALUES (
--   'your-workspace-id',
--   'keyword',
--   'sales automation AI',
--   60
-- );
