-- Migration: 060-email-campaign-prospects.sql
-- Purpose: Create email_campaign_prospects table for ReachInbox data
-- Date: December 18, 2025

CREATE TABLE IF NOT EXISTS email_campaign_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Campaign & Workspace
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Prospect Info
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  title TEXT,

  -- ReachInbox IDs
  reachinbox_campaign_id TEXT,
  reachinbox_lead_id TEXT,

  -- Email Metrics
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced BOOLEAN DEFAULT FALSE,

  -- Timestamps
  first_sent_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,

  -- Reply tracking
  reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'negative', 'neutral')),

  -- Funnel tracking (same as LinkedIn)
  meeting_booked BOOLEAN DEFAULT FALSE,
  meeting_booked_at TIMESTAMPTZ,
  trial_signup BOOLEAN DEFAULT FALSE,
  trial_signup_at TIMESTAMPTZ,
  converted_to_mrr BOOLEAN DEFAULT FALSE,
  mrr_converted_at TIMESTAMPTZ,
  mrr_value NUMERIC(10,2),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'replied', 'converted')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_prospects_campaign ON email_campaign_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_prospects_workspace ON email_campaign_prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_email_prospects_email ON email_campaign_prospects(email);
CREATE INDEX IF NOT EXISTS idx_email_prospects_reachinbox ON email_campaign_prospects(reachinbox_lead_id);
CREATE INDEX IF NOT EXISTS idx_email_prospects_status ON email_campaign_prospects(status);
CREATE INDEX IF NOT EXISTS idx_email_prospects_replied ON email_campaign_prospects(replied_at) WHERE replied_at IS NOT NULL;

-- Enable RLS
ALTER TABLE email_campaign_prospects ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see prospects in their workspace
CREATE POLICY "Users can view email prospects in their workspace"
  ON email_campaign_prospects FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Comment
COMMENT ON TABLE email_campaign_prospects IS 'Email campaign prospects synced from ReachInbox';
