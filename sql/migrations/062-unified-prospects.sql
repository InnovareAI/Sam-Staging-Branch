-- Migration: 062-unified-prospects.sql
-- Purpose: Create unified prospect view across LinkedIn and Email channels
-- Date: December 18, 2025

-- Unified Prospects Table
-- This is the master prospect database that combines LinkedIn and Email contacts
CREATE TABLE IF NOT EXISTS unified_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Identity (deduped by email or linkedin_url)
  email TEXT,
  linkedin_url TEXT,

  -- Contact Info
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (
    COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')
  ) STORED,
  company TEXT,
  title TEXT,
  industry TEXT,
  country TEXT,
  phone TEXT,

  -- Source tracking
  source_channel TEXT CHECK (source_channel IN ('linkedin', 'email', 'both')),
  linkedin_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  email_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  linkedin_prospect_id UUID, -- FK to campaign_prospects
  email_prospect_id UUID,    -- FK to email_campaign_prospects

  -- LinkedIn Status
  linkedin_status TEXT CHECK (linkedin_status IN (
    'none', 'pending', 'sent', 'connected', 'replied', 'failed'
  )) DEFAULT 'none',
  linkedin_sent_at TIMESTAMPTZ,
  linkedin_connected_at TIMESTAMPTZ,
  linkedin_replied_at TIMESTAMPTZ,
  linkedin_last_message TEXT,

  -- Email Status
  email_status TEXT CHECK (email_status IN (
    'none', 'pending', 'sent', 'opened', 'clicked', 'replied', 'bounced'
  )) DEFAULT 'none',
  email_sent_at TIMESTAMPTZ,
  email_opened_at TIMESTAMPTZ,
  email_replied_at TIMESTAMPTZ,
  email_bounced BOOLEAN DEFAULT FALSE,

  -- Overall Funnel Status
  overall_status TEXT CHECK (overall_status IN (
    'new',           -- Just added, not contacted
    'contacted',     -- Outreach sent (any channel)
    'engaged',       -- Opened/connected but no reply
    'replied',       -- Got a reply (any channel)
    'positive',      -- Positive reply sentiment
    'meeting_booked',
    'trial_signup',
    'converted',     -- Became MRR client
    'not_interested',
    'do_not_contact'
  )) DEFAULT 'new',

  -- Reply tracking
  reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'negative', 'neutral')),
  reply_content TEXT,

  -- Message History (JSONB array for full conversation)
  -- Format: [{ sender: 'campaign'|'prospect'|'reply_agent', channel: 'linkedin'|'email', content: '...', sent_at: '...' }]
  message_history JSONB DEFAULT '[]'::jsonb,

  -- Quick access to key messages
  initial_outreach_message TEXT,      -- First message we sent
  prospect_reply_message TEXT,        -- Their reply
  reply_agent_response TEXT,          -- Our reply agent's response
  last_message_content TEXT,          -- Most recent message
  last_message_sender TEXT,           -- 'us' or 'prospect'
  last_message_at TIMESTAMPTZ,

  -- Repurpose tracking
  can_repurpose BOOLEAN GENERATED ALWAYS AS (
    -- Can repurpose if contacted on one channel but no reply, and other channel available
    (linkedin_status IN ('sent', 'connected', 'failed') AND linkedin_replied_at IS NULL AND email IS NOT NULL AND email_status = 'none')
    OR
    (email_status IN ('sent', 'opened', 'clicked', 'bounced') AND email_replied_at IS NULL AND linkedin_url IS NOT NULL AND linkedin_status = 'none')
  ) STORED,
  repurpose_channel TEXT, -- 'linkedin' or 'email' - which channel to try next
  repurposed_at TIMESTAMPTZ,

  -- Conversion funnel
  meeting_booked BOOLEAN DEFAULT FALSE,
  meeting_booked_at TIMESTAMPTZ,
  meeting_occurred BOOLEAN DEFAULT FALSE,
  trial_signup BOOLEAN DEFAULT FALSE,
  trial_signup_at TIMESTAMPTZ,
  converted_to_mrr BOOLEAN DEFAULT FALSE,
  mrr_converted_at TIMESTAMPTZ,
  mrr_value NUMERIC(10,2),

  -- Metadata
  notes TEXT,
  tags TEXT[],
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unified_prospects_workspace ON unified_prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_unified_prospects_email ON unified_prospects(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_prospects_linkedin ON unified_prospects(linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_prospects_overall_status ON unified_prospects(overall_status);
CREATE INDEX IF NOT EXISTS idx_unified_prospects_can_repurpose ON unified_prospects(can_repurpose) WHERE can_repurpose = TRUE;
CREATE INDEX IF NOT EXISTS idx_unified_prospects_replied ON unified_prospects(overall_status) WHERE overall_status IN ('replied', 'positive');

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_prospects_unique_email
  ON unified_prospects(workspace_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_prospects_unique_linkedin
  ON unified_prospects(workspace_id, linkedin_url) WHERE linkedin_url IS NOT NULL;

-- Enable RLS
ALTER TABLE unified_prospects ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view prospects in their workspace"
  ON unified_prospects FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_unified_prospects_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_activity_at = GREATEST(
    NEW.linkedin_sent_at,
    NEW.linkedin_connected_at,
    NEW.linkedin_replied_at,
    NEW.email_sent_at,
    NEW.email_opened_at,
    NEW.email_replied_at,
    NEW.last_activity_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unified_prospects_updated
  BEFORE UPDATE ON unified_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_unified_prospects_timestamp();

-- Comments
COMMENT ON TABLE unified_prospects IS 'Unified prospect database combining LinkedIn and Email contacts for multi-channel outreach';
COMMENT ON COLUMN unified_prospects.can_repurpose IS 'Auto-calculated: TRUE if prospect can be contacted on another channel';
COMMENT ON COLUMN unified_prospects.overall_status IS 'Master funnel status across all channels';
