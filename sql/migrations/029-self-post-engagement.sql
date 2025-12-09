-- Migration: 029-self-post-engagement.sql
-- Date: December 9, 2025
-- Purpose: Add Self-Post Engagement feature - monitor own posts and reply to comments
--
-- Use Case: Client posts about an event, SAM monitors for comments and auto-replies
-- with custom per-post prompts (e.g., event sign-up links, product info)

-- ============================================
-- Table 1: linkedin_self_post_monitors
-- Tracks which of YOUR OWN posts to monitor for comments
-- ============================================

CREATE TABLE IF NOT EXISTS linkedin_self_post_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Post identification
  post_url TEXT NOT NULL,                    -- LinkedIn post URL (user provides)
  post_social_id TEXT,                       -- urn:li:activity:xxx (resolved from URL)
  post_ugc_id TEXT,                          -- urn:li:ugcPost:xxx (for API operations)

  -- Post context (cached for AI)
  post_title TEXT,                           -- User-friendly name (e.g., "AI Summit 2025")
  post_content TEXT,                         -- Original post text (fetched from LinkedIn)
  post_author_name TEXT,                     -- Author name (your name)
  posted_at TIMESTAMPTZ,                     -- When the post was created

  -- Custom reply prompt (THE KEY FEATURE)
  reply_prompt TEXT NOT NULL,                -- e.g., "Reply with event signup link..."
  reply_context JSONB DEFAULT '{}',          -- Structured data: {signup_link, event_date, etc.}

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  auto_approve_replies BOOLEAN DEFAULT false, -- If true, skip HITL approval
  max_replies_per_day INTEGER DEFAULT 20,     -- Rate limit per post
  check_frequency_minutes INTEGER DEFAULT 30, -- How often to check for new comments

  -- Reply settings
  reply_to_questions_only BOOLEAN DEFAULT false, -- Only reply to comments with questions
  skip_single_word_comments BOOLEAN DEFAULT true, -- Skip "Great!" "Nice!" etc.
  min_comment_length INTEGER DEFAULT 10,          -- Minimum chars to warrant reply

  -- Tracking
  last_checked_at TIMESTAMPTZ,
  last_comment_id TEXT,                      -- Track last seen comment to avoid duplicates
  total_comments_found INTEGER DEFAULT 0,
  total_replies_sent INTEGER DEFAULT 0,
  replies_sent_today INTEGER DEFAULT 0,
  replies_reset_date DATE DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_workspace_post UNIQUE(workspace_id, post_url)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_self_post_monitors_workspace
  ON linkedin_self_post_monitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_self_post_monitors_active
  ON linkedin_self_post_monitors(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_self_post_monitors_next_check
  ON linkedin_self_post_monitors(last_checked_at, check_frequency_minutes);

-- ============================================
-- Table 2: linkedin_self_post_comment_replies
-- Tracks comments found and replies generated/sent
-- ============================================

CREATE TABLE IF NOT EXISTS linkedin_self_post_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  monitor_id UUID NOT NULL REFERENCES linkedin_self_post_monitors(id) ON DELETE CASCADE,

  -- Original comment info (from LinkedIn)
  comment_linkedin_id TEXT NOT NULL,         -- urn:li:comment:(activityId,commentId)
  comment_text TEXT NOT NULL,
  commenter_name TEXT,
  commenter_headline TEXT,
  commenter_linkedin_url TEXT,
  commenter_provider_id TEXT,                -- Unipile provider ID for the commenter
  commented_at TIMESTAMPTZ,

  -- Comment metadata
  comment_likes_count INTEGER DEFAULT 0,
  is_question BOOLEAN DEFAULT false,         -- AI-detected question
  sentiment TEXT,                            -- positive, neutral, negative

  -- Generated reply
  reply_text TEXT,
  generation_metadata JSONB DEFAULT '{}',    -- AI reasoning, confidence, etc.
  confidence_score DECIMAL(3,2),             -- 0.00 to 1.00

  -- Approval workflow (HITL)
  status TEXT NOT NULL DEFAULT 'pending_generation'
    CHECK (status IN (
      'pending_generation',  -- Waiting for AI to generate reply
      'pending_approval',    -- Generated, awaiting human approval
      'approved',            -- Approved, waiting to be scheduled
      'scheduled',           -- Scheduled for posting
      'posting',             -- Currently being posted (claimed)
      'posted',              -- Successfully posted to LinkedIn
      'rejected',            -- Human rejected the reply
      'failed',              -- Failed to post
      'skipped'              -- Skipped (duplicate, too short, etc.)
    )),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Scheduling & posting
  scheduled_post_time TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  reply_linkedin_id TEXT,                    -- ID of the posted reply comment
  failure_reason TEXT,
  post_response JSONB,                       -- Full Unipile response

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate replies to same comment
  CONSTRAINT unique_monitor_comment UNIQUE(monitor_id, comment_linkedin_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_self_post_replies_workspace
  ON linkedin_self_post_comment_replies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_self_post_replies_monitor
  ON linkedin_self_post_comment_replies(monitor_id);
CREATE INDEX IF NOT EXISTS idx_self_post_replies_status
  ON linkedin_self_post_comment_replies(status);
CREATE INDEX IF NOT EXISTS idx_self_post_replies_scheduled
  ON linkedin_self_post_comment_replies(scheduled_post_time)
  WHERE status = 'scheduled';

-- ============================================
-- RLS Policies - Workspace Isolation
-- ============================================

ALTER TABLE linkedin_self_post_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_self_post_comment_replies ENABLE ROW LEVEL SECURITY;

-- Self-post monitors: workspace members only
CREATE POLICY "workspace_members_select_self_post_monitors"
  ON linkedin_self_post_monitors FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_self_post_monitors"
  ON linkedin_self_post_monitors FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_update_self_post_monitors"
  ON linkedin_self_post_monitors FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_delete_self_post_monitors"
  ON linkedin_self_post_monitors FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Comment replies: workspace members only
CREATE POLICY "workspace_members_select_self_post_replies"
  ON linkedin_self_post_comment_replies FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_self_post_replies"
  ON linkedin_self_post_comment_replies FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_update_self_post_replies"
  ON linkedin_self_post_comment_replies FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_delete_self_post_replies"
  ON linkedin_self_post_comment_replies FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role bypass for cron jobs
CREATE POLICY "service_role_all_self_post_monitors"
  ON linkedin_self_post_monitors FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "service_role_all_self_post_replies"
  ON linkedin_self_post_comment_replies FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- Verification
-- ============================================

SELECT 'Self-Post Engagement tables created' as status;
