-- Migration: 030-self-post-lead-capture.sql
-- Date: December 9, 2025
-- Purpose: Extend Self-Post Engagement with Lead Capture Pipeline
--
-- Flow: Your Post → Comments → Score Commenter → Reply → CR → DM Sequence → CRM
--
-- This turns post engagement into a full lead generation machine:
-- 1. Score commenters based on title, company, connections
-- 2. Auto-send connection request if score > threshold
-- 3. Once connected, enroll in DM follow-up sequence
-- 4. Sync lead data to CRM with attribution

-- ============================================
-- Step 1: Extend linkedin_self_post_monitors
-- Add lead capture configuration
-- ============================================

ALTER TABLE linkedin_self_post_monitors
ADD COLUMN IF NOT EXISTS auto_connect_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_connect_min_score INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS auto_connect_message TEXT,
ADD COLUMN IF NOT EXISTS dm_sequence_campaign_id UUID REFERENCES campaigns(id),
ADD COLUMN IF NOT EXISTS crm_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS crm_provider TEXT, -- 'hubspot', 'activecampaign', 'airtable'
ADD COLUMN IF NOT EXISTS crm_list_id TEXT,
ADD COLUMN IF NOT EXISTS crm_tags TEXT[], -- Tags to apply in CRM
ADD COLUMN IF NOT EXISTS lead_source_label TEXT DEFAULT 'LinkedIn Post Comment';

-- ============================================
-- Step 2: Extend linkedin_self_post_comment_replies
-- Add commenter profile and lead capture tracking
-- ============================================

ALTER TABLE linkedin_self_post_comment_replies
ADD COLUMN IF NOT EXISTS commenter_score INTEGER,
ADD COLUMN IF NOT EXISTS commenter_title TEXT,
ADD COLUMN IF NOT EXISTS commenter_company TEXT,
ADD COLUMN IF NOT EXISTS commenter_location TEXT,
ADD COLUMN IF NOT EXISTS commenter_connections INTEGER,
ADD COLUMN IF NOT EXISTS commenter_is_1st_degree BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS connection_request_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS connection_request_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS connection_request_message TEXT,
ADD COLUMN IF NOT EXISTS connection_accepted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS connection_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dm_sequence_enrolled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dm_sequence_enrolled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dm_sequence_prospect_id UUID,
ADD COLUMN IF NOT EXISTS crm_synced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS crm_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS crm_contact_id TEXT,
ADD COLUMN IF NOT EXISTS crm_sync_error TEXT;

-- ============================================
-- Step 3: Create lead scoring configuration table
-- Allows per-workspace customization of scoring rules
-- ============================================

CREATE TABLE IF NOT EXISTS linkedin_lead_scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Title-based scoring (keywords in job title)
  title_keywords JSONB DEFAULT '{
    "ceo": 30, "cto": 30, "cfo": 25, "coo": 25,
    "founder": 30, "co-founder": 30, "owner": 25,
    "president": 25, "partner": 20,
    "vp": 20, "vice president": 20,
    "director": 15, "head of": 15,
    "manager": 10, "lead": 10,
    "senior": 5, "principal": 5
  }',

  -- Company-based scoring (company size, industry)
  company_size_scoring JSONB DEFAULT '{
    "1-10": 5, "11-50": 10, "51-200": 15,
    "201-500": 20, "501-1000": 25,
    "1001-5000": 20, "5001-10000": 15,
    "10001+": 10
  }',

  -- Target industries (bonus points)
  target_industries TEXT[] DEFAULT '{}',
  industry_bonus INTEGER DEFAULT 15,

  -- Connection degree scoring
  first_degree_bonus INTEGER DEFAULT 20,
  second_degree_bonus INTEGER DEFAULT 10,
  third_degree_bonus INTEGER DEFAULT 0,

  -- Engagement scoring
  comment_length_bonus INTEGER DEFAULT 5, -- Per 50 chars
  question_bonus INTEGER DEFAULT 10, -- If comment contains question

  -- Minimum score for auto-actions
  min_score_for_cr INTEGER DEFAULT 50,
  min_score_for_dm_sequence INTEGER DEFAULT 60,
  min_score_for_crm_sync INTEGER DEFAULT 40,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_workspace_scoring UNIQUE(workspace_id)
);

-- ============================================
-- Step 4: Create lead capture queue table
-- Tracks pending lead capture actions
-- ============================================

CREATE TABLE IF NOT EXISTS linkedin_lead_capture_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  comment_reply_id UUID NOT NULL REFERENCES linkedin_self_post_comment_replies(id) ON DELETE CASCADE,

  -- Commenter info (denormalized for queue processing)
  commenter_provider_id TEXT NOT NULL,
  commenter_name TEXT,
  commenter_linkedin_url TEXT,
  commenter_score INTEGER,

  -- Action type
  action_type TEXT NOT NULL CHECK (action_type IN ('connection_request', 'dm_sequence', 'crm_sync')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Action-specific data
  action_data JSONB DEFAULT '{}',

  -- Result
  result_data JSONB DEFAULT '{}',
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_action_per_comment UNIQUE(comment_reply_id, action_type)
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_lead_capture_queue_pending
  ON linkedin_lead_capture_queue(status, scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lead_capture_queue_workspace
  ON linkedin_lead_capture_queue(workspace_id);

-- ============================================
-- Step 5: RLS Policies
-- ============================================

ALTER TABLE linkedin_lead_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_lead_capture_queue ENABLE ROW LEVEL SECURITY;

-- Scoring rules: workspace members only
CREATE POLICY "workspace_members_select_scoring_rules"
  ON linkedin_lead_scoring_rules FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_members_all_scoring_rules"
  ON linkedin_lead_scoring_rules FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Lead capture queue: workspace members only
CREATE POLICY "workspace_members_select_lead_queue"
  ON linkedin_lead_capture_queue FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "workspace_members_all_lead_queue"
  ON linkedin_lead_capture_queue FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Service role bypass
CREATE POLICY "service_role_all_scoring_rules"
  ON linkedin_lead_scoring_rules FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "service_role_all_lead_queue"
  ON linkedin_lead_capture_queue FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- Step 6: Insert default scoring rules for existing workspaces
-- ============================================

INSERT INTO linkedin_lead_scoring_rules (workspace_id)
SELECT id FROM workspaces
WHERE id NOT IN (SELECT workspace_id FROM linkedin_lead_scoring_rules)
ON CONFLICT (workspace_id) DO NOTHING;

-- ============================================
-- Verification
-- ============================================

SELECT 'Lead capture pipeline tables updated' as status;
