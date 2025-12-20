-- Migration: Link Tracking for Agentic Follow-up
-- Purpose: Track when prospects click links (calendar, demo, PDF) to trigger smart follow-ups
-- Date: 2025-12-20

-- ============================================
-- 1. TRACKED LINKS - Store unique links per recipient
-- ============================================

CREATE TABLE IF NOT EXISTS tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Short code for URL (e.g., /t/abc123)
  short_code TEXT NOT NULL UNIQUE,

  -- Original destination URL
  destination_url TEXT NOT NULL,

  -- Link type for agent logic
  link_type TEXT NOT NULL,  -- 'calendar', 'demo_video', 'one_pager', 'case_study', 'trial', 'website', 'other'

  -- Who this link is for (one unique link per prospect per destination)
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Source context
  source_type TEXT,  -- 'reply_agent', 'follow_up_agent', 'campaign_sequence', 'manual'
  source_id UUID,    -- reply_agent_drafts.id, follow_up_drafts.id, etc.

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Optional expiration

  -- Indexes for lookups
  CONSTRAINT tracked_links_short_code_idx UNIQUE (short_code)
);

-- Index for finding links by prospect
CREATE INDEX IF NOT EXISTS idx_tracked_links_prospect ON tracked_links(prospect_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_workspace ON tracked_links(workspace_id);

-- ============================================
-- 2. LINK CLICKS - Track every click event
-- ============================================

CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which link was clicked
  tracked_link_id UUID NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,

  -- Click metadata
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,

  -- Geo data (optional, can be enriched later)
  country TEXT,
  city TEXT,

  -- Is this the first click? (important for agent logic)
  is_first_click BOOLEAN DEFAULT FALSE
);

-- Index for finding clicks by link
CREATE INDEX IF NOT EXISTS idx_link_clicks_tracked_link ON link_clicks(tracked_link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at);

-- ============================================
-- 3. CAMPAIGN_PROSPECTS - Add click tracking fields
-- ============================================

-- Track when prospect clicked each type of link
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS first_calendar_click_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_demo_click_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_pdf_click_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS total_link_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_link_click_at TIMESTAMPTZ;

-- ============================================
-- 4. AGENT ENGAGEMENT SCORING
-- ============================================

-- Engagement score based on link clicks (for prioritizing follow-ups)
-- This can be computed or stored
COMMENT ON COLUMN campaign_prospects.total_link_clicks IS 'Total number of tracked link clicks by this prospect';
COMMENT ON COLUMN campaign_prospects.first_calendar_click_at IS 'First time prospect clicked a calendar link - high intent signal';
COMMENT ON COLUMN campaign_prospects.first_demo_click_at IS 'First time prospect clicked demo video - interest signal';
COMMENT ON COLUMN campaign_prospects.first_pdf_click_at IS 'First time prospect clicked PDF/one-pager - research signal';

-- ============================================
-- 5. RLS POLICIES
-- ============================================

ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- Workspace members can view their tracked links
CREATE POLICY tracked_links_workspace_access ON tracked_links
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role for cron jobs
CREATE POLICY tracked_links_service_role ON tracked_links
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY link_clicks_service_role ON link_clicks
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 6. FUNCTION: Generate unique short code
-- ============================================

CREATE OR REPLACE FUNCTION generate_short_code(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';  -- No confusing chars (0,o,1,l,i)
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. COMMENTS
-- ============================================

COMMENT ON TABLE tracked_links IS 'Unique tracked links per prospect for engagement tracking';
COMMENT ON TABLE link_clicks IS 'Click events on tracked links - triggers agent follow-ups';
COMMENT ON COLUMN tracked_links.link_type IS 'Type of link: calendar, demo_video, one_pager, case_study, trial, website, other';
COMMENT ON COLUMN tracked_links.source_type IS 'What created this link: reply_agent, follow_up_agent, campaign_sequence, manual';

-- ============================================
-- 8. FUNCTION: Increment link clicks safely
-- ============================================

CREATE OR REPLACE FUNCTION increment_link_clicks(prospect_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE campaign_prospects
  SET total_link_clicks = COALESCE(total_link_clicks, 0) + 1
  WHERE id = prospect_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. CONVERSATION STAGES FOR LINK ENGAGEMENT
-- ============================================

-- Add new conversation stages for link engagement
COMMENT ON COLUMN campaign_prospects.conversation_stage IS 'Stages: initial_outreach, awaiting_response, awaiting_booking, prospect_shared_calendar, availability_ready, meeting_scheduled, meeting_completed, meeting_cancelled, no_show_follow_up, follow_up_needed, calendar_clicked_pending_booking, engaged_watching_demo, engaged_researching, trial_started, closed';
