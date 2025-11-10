-- LinkedIn Commenting Agent Database Schema
-- This implements a Haiku-optimized commenting system for LinkedIn engagement
-- Gated behind AI Settings unlock

-- ============================================================================
-- 1. WORKSPACE SETTINGS - Commenting Agent Feature Flag
-- ============================================================================

-- Add commenting_agent_enabled to workspace settings
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS commenting_agent_enabled BOOLEAN DEFAULT FALSE;

-- Index for quick feature check
CREATE INDEX IF NOT EXISTS idx_workspaces_commenting_enabled
ON workspaces(commenting_agent_enabled) WHERE commenting_agent_enabled = TRUE;

-- ============================================================================
-- 2. COMMENTING CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS linkedin_comment_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Campaign identity
  campaign_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),

  -- Targeting configuration
  targeting_mode TEXT NOT NULL CHECK (targeting_mode IN ('hashtag', 'keyword', 'profile')),
  target_hashtags TEXT[], -- For hashtag mode: ['#SaaS', '#B2BSales']
  target_keywords TEXT[], -- For keyword mode: ['sales automation', 'outbound']
  target_profiles JSONB,  -- For profile mode: [{url, name, type: 'person'|'company'}]

  -- Search filters
  date_range TEXT DEFAULT 'past_week' CHECK (date_range IN ('past_24_hours', 'past_week', 'past_month')),
  content_type TEXT DEFAULT 'all' CHECK (content_type IN ('all', 'text', 'images', 'videos')),
  min_engagement INT DEFAULT 0, -- Minimum reactions/comments
  author_filter JSONB, -- {job_titles: ['CEO', 'VP'], industries: [...]}

  -- Comment generation strategy
  comment_strategy TEXT DEFAULT 'tiered' CHECK (comment_strategy IN ('tiered', 'template', 'haiku_only')),
  comment_templates JSONB, -- Template options for template/tiered mode
  ai_instructions TEXT DEFAULT 'Be professional and helpful. Add genuine value to the conversation.',

  -- Rate limiting & safety
  max_comments_per_day INT DEFAULT 15 CHECK (max_comments_per_day BETWEEN 1 AND 30),
  min_relevance_score DECIMAL DEFAULT 0.7 CHECK (min_relevance_score BETWEEN 0 AND 1),
  auto_approve BOOLEAN DEFAULT FALSE, -- Skip HITL approval
  posting_schedule JSONB, -- {hours: [9, 10, 11, 14, 15, 16], timezone: 'America/New_York'}

  -- LinkedIn account
  linkedin_account_id TEXT, -- Unipile account ID

  -- Execution tracking
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  run_frequency TEXT DEFAULT 'daily' CHECK (run_frequency IN ('hourly', 'every_6_hours', 'daily', 'manual')),

  -- Statistics
  total_posts_found INT DEFAULT 0,
  total_comments_posted INT DEFAULT 0,
  total_engagement_received INT DEFAULT 0, -- Likes + replies on our comments

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_comment_campaigns_workspace ON linkedin_comment_campaigns(workspace_id);
CREATE INDEX idx_comment_campaigns_user ON linkedin_comment_campaigns(user_id);
CREATE INDEX idx_comment_campaigns_status ON linkedin_comment_campaigns(status);
CREATE INDEX idx_comment_campaigns_next_run ON linkedin_comment_campaigns(next_run_at) WHERE status = 'active';

-- RLS Policies
ALTER TABLE linkedin_comment_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaigns in their workspace"
  ON linkedin_comment_campaigns FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create campaigns in their workspace"
  ON linkedin_comment_campaigns FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own campaigns"
  ON linkedin_comment_campaigns FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own campaigns"
  ON linkedin_comment_campaigns FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. POSTS QUEUE - Discovered posts awaiting approval/commenting
-- ============================================================================

CREATE TABLE IF NOT EXISTS linkedin_posts_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES linkedin_comment_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Post identification
  post_id TEXT NOT NULL, -- Unipile post ID
  post_url TEXT,
  post_social_id TEXT, -- LinkedIn URN (urn:li:activity:...)

  -- Post content
  post_text TEXT NOT NULL,
  post_author_name TEXT,
  post_author_profile TEXT,
  post_author_title TEXT,
  post_author_company TEXT,
  post_date TIMESTAMP,
  post_metadata JSONB, -- Full Unipile response

  -- Engagement metrics
  post_reactions INT DEFAULT 0,
  post_comments INT DEFAULT 0,
  post_shares INT DEFAULT 0,

  -- AI scoring
  relevance_score DECIMAL, -- 0-1 score
  ai_analysis JSONB, -- {reason: 'why relevant', topic: 'main topic', sentiment: 'positive'}
  comment_tier TEXT CHECK (comment_tier IN ('template', 'haiku_light', 'haiku_full')),

  -- Comment generation
  suggested_comment TEXT,
  approved_comment TEXT,
  comment_generation_method TEXT CHECK (comment_generation_method IN ('template', 'haiku_light', 'haiku_full')),
  generation_cost DECIMAL DEFAULT 0, -- Cost in USD

  -- Approval workflow (HITL)
  comment_status TEXT DEFAULT 'pending' CHECK (comment_status IN ('pending', 'approved', 'rejected', 'commented', 'failed')),
  requires_approval BOOLEAN DEFAULT TRUE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,

  -- Timestamps
  discovered_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_posts_queue_campaign ON linkedin_posts_queue(campaign_id);
CREATE INDEX idx_posts_queue_workspace ON linkedin_posts_queue(workspace_id);
CREATE INDEX idx_posts_queue_status ON linkedin_posts_queue(comment_status);
CREATE INDEX idx_posts_queue_post_id ON linkedin_posts_queue(post_id); -- Prevent duplicates
CREATE UNIQUE INDEX idx_posts_queue_unique_post_campaign ON linkedin_posts_queue(post_id, campaign_id);

-- RLS Policies
ALTER TABLE linkedin_posts_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view posts queue in their workspace"
  ON linkedin_posts_queue FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert posts queue"
  ON linkedin_posts_queue FOR INSERT
  WITH CHECK (true); -- Allow service role (cron jobs)

CREATE POLICY "Users can update posts in their campaigns"
  ON linkedin_posts_queue FOR UPDATE
  USING (
    campaign_id IN (
      SELECT id FROM linkedin_comment_campaigns WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. COMMENTS SENT - Tracking posted comments and engagement
-- ============================================================================

CREATE TABLE IF NOT EXISTS linkedin_comments_sent (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES linkedin_comment_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  queue_item_id UUID REFERENCES linkedin_posts_queue(id) ON DELETE SET NULL,

  -- Post details
  post_id TEXT NOT NULL,
  post_url TEXT,
  post_author_name TEXT,
  post_author_profile TEXT,
  post_text TEXT,
  post_date TIMESTAMP,

  -- Comment details
  comment_id TEXT, -- Unipile comment ID
  comment_text TEXT NOT NULL,
  commented_at TIMESTAMP DEFAULT NOW(),

  -- Comment generation metadata
  generation_method TEXT CHECK (generation_method IN ('template', 'haiku_light', 'haiku_full', 'manual')),
  generation_cost DECIMAL DEFAULT 0,
  ai_model TEXT DEFAULT 'anthropic/claude-haiku-4.5',
  relevance_score DECIMAL,

  -- Engagement tracking
  comment_likes INT DEFAULT 0,
  comment_replies INT DEFAULT 0,
  author_replied BOOLEAN DEFAULT FALSE,
  author_connected BOOLEAN DEFAULT FALSE, -- Did post author connect with us?
  author_messaged BOOLEAN DEFAULT FALSE, -- Did post author DM us?

  -- Lead scoring
  lead_score INT DEFAULT 0, -- 0-100, based on engagement
  converted_to_prospect BOOLEAN DEFAULT FALSE,
  prospect_id UUID REFERENCES workspace_prospects(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'posted' CHECK (status IN ('posted', 'edited', 'deleted', 'flagged')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  last_engagement_check TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_comments_sent_campaign ON linkedin_comments_sent(campaign_id);
CREATE INDEX idx_comments_sent_workspace ON linkedin_comments_sent(workspace_id);
CREATE INDEX idx_comments_sent_post ON linkedin_comments_sent(post_id);
CREATE INDEX idx_comments_sent_commented_at ON linkedin_comments_sent(commented_at DESC);
CREATE INDEX idx_comments_sent_author_replied ON linkedin_comments_sent(author_replied) WHERE author_replied = TRUE;

-- RLS Policies
ALTER TABLE linkedin_comments_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments in their workspace"
  ON linkedin_comments_sent FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert comments"
  ON linkedin_comments_sent FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update comments"
  ON linkedin_comments_sent FOR UPDATE
  USING (true);

-- ============================================================================
-- 5. CAMPAIGN ANALYTICS - Daily rollup for performance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS linkedin_comment_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES linkedin_comment_campaigns(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Discovery metrics
  posts_found INT DEFAULT 0,
  posts_relevant INT DEFAULT 0,
  avg_relevance_score DECIMAL,

  -- Comment metrics
  comments_generated INT DEFAULT 0,
  comments_approved INT DEFAULT 0,
  comments_rejected INT DEFAULT 0,
  comments_posted INT DEFAULT 0,

  -- Generation breakdown
  comments_template INT DEFAULT 0,
  comments_haiku_light INT DEFAULT 0,
  comments_haiku_full INT DEFAULT 0,

  -- Cost tracking
  total_cost DECIMAL DEFAULT 0,
  avg_cost_per_comment DECIMAL,

  -- Engagement metrics
  total_likes INT DEFAULT 0,
  total_replies INT DEFAULT 0,
  author_replies INT DEFAULT 0,
  new_connections INT DEFAULT 0,

  -- Conversion metrics
  leads_generated INT DEFAULT 0,
  meetings_booked INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(campaign_id, date)
);

-- Indexes
CREATE INDEX idx_comment_analytics_campaign ON linkedin_comment_analytics(campaign_id);
CREATE INDEX idx_comment_analytics_date ON linkedin_comment_analytics(date DESC);
CREATE INDEX idx_comment_analytics_workspace_date ON linkedin_comment_analytics(workspace_id, date DESC);

-- RLS Policies
ALTER TABLE linkedin_comment_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics in their workspace"
  ON linkedin_comment_analytics FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate engagement score for a comment
CREATE OR REPLACE FUNCTION calculate_comment_engagement_score(
  likes INT,
  replies INT,
  author_replied BOOLEAN,
  author_connected BOOLEAN,
  author_messaged BOOLEAN
) RETURNS INT AS $$
BEGIN
  RETURN
    (likes * 1) +           -- 1 point per like
    (replies * 5) +         -- 5 points per reply
    (CASE WHEN author_replied THEN 20 ELSE 0 END) +    -- 20 points if author replied
    (CASE WHEN author_connected THEN 50 ELSE 0 END) +  -- 50 points if author connected
    (CASE WHEN author_messaged THEN 100 ELSE 0 END);   -- 100 points if author messaged
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update campaign statistics
CREATE OR REPLACE FUNCTION update_campaign_stats(campaign_uuid UUID) RETURNS VOID AS $$
BEGIN
  UPDATE linkedin_comment_campaigns
  SET
    total_posts_found = (
      SELECT COUNT(*) FROM linkedin_posts_queue WHERE campaign_id = campaign_uuid
    ),
    total_comments_posted = (
      SELECT COUNT(*) FROM linkedin_comments_sent WHERE campaign_id = campaign_uuid
    ),
    total_engagement_received = (
      SELECT COALESCE(SUM(comment_likes + comment_replies), 0)
      FROM linkedin_comments_sent
      WHERE campaign_id = campaign_uuid
    ),
    updated_at = NOW()
  WHERE id = campaign_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Auto-update campaign stats when comment is posted
CREATE OR REPLACE FUNCTION trigger_update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_campaign_stats(NEW.campaign_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_comment_sent
  AFTER INSERT OR UPDATE ON linkedin_comments_sent
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_campaign_stats();

-- Auto-update engagement scores
CREATE OR REPLACE FUNCTION trigger_update_engagement_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.lead_score = calculate_comment_engagement_score(
    NEW.comment_likes,
    NEW.comment_replies,
    NEW.author_replied,
    NEW.author_connected,
    NEW.author_messaged
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_comment_update_engagement
  BEFORE UPDATE ON linkedin_comments_sent
  FOR EACH ROW
  WHEN (
    OLD.comment_likes != NEW.comment_likes OR
    OLD.comment_replies != NEW.comment_replies OR
    OLD.author_replied != NEW.author_replied OR
    OLD.author_connected != NEW.author_connected OR
    OLD.author_messaged != NEW.author_messaged
  )
  EXECUTE FUNCTION trigger_update_engagement_score();

-- ============================================================================
-- DONE
-- ============================================================================

COMMENT ON TABLE linkedin_comment_campaigns IS 'LinkedIn commenting campaigns with hashtag/keyword/profile targeting';
COMMENT ON TABLE linkedin_posts_queue IS 'Discovered LinkedIn posts awaiting comment approval';
COMMENT ON TABLE linkedin_comments_sent IS 'Posted comments with engagement tracking';
COMMENT ON TABLE linkedin_comment_analytics IS 'Daily rollup analytics for campaign performance';
