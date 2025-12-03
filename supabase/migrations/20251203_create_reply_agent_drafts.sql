-- Reply Agent Drafts table - stores AI-generated reply drafts for HITL approval
CREATE TABLE IF NOT EXISTS reply_agent_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE SET NULL,

  -- Message context
  inbound_message_id TEXT NOT NULL,
  inbound_message_text TEXT NOT NULL,
  inbound_message_at TIMESTAMP WITH TIME ZONE NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'linkedin',

  -- Prospect info (cached for reference)
  prospect_name TEXT,
  prospect_linkedin_url TEXT,
  prospect_company TEXT,
  prospect_title TEXT,

  -- Research data
  research_linkedin_profile JSONB,
  research_company_profile JSONB,
  research_website TEXT,

  -- AI-generated draft
  draft_text TEXT NOT NULL,
  intent_detected VARCHAR(50),
  ai_model TEXT,

  -- HITL workflow
  status VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
  approval_token UUID DEFAULT gen_random_uuid(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  edited_text TEXT,
  rejection_reason TEXT,

  -- Sending
  sent_at TIMESTAMP WITH TIME ZONE,
  send_error TEXT,
  outbound_message_id TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '48 hours')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reply_drafts_workspace ON reply_agent_drafts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_status ON reply_agent_drafts(status);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_token ON reply_agent_drafts(approval_token);
CREATE INDEX IF NOT EXISTS idx_reply_drafts_inbound_id ON reply_agent_drafts(inbound_message_id);

-- Enable RLS
ALTER TABLE reply_agent_drafts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view drafts for their workspaces"
  ON reply_agent_drafts FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update drafts for their workspaces"
  ON reply_agent_drafts FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
