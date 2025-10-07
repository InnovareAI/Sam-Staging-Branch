-- Create campaign_replies table for HITL email workflow
-- Simplified version focused on email reply tracking and HITL workflow
-- This version doesn't require campaign_messages or other complex dependencies

CREATE TABLE IF NOT EXISTS campaign_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core associations
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  prospect_id UUID, -- Links to workspace_prospects (FK will be added when that table exists)

  -- Reply content and metadata
  reply_text TEXT,
  platform TEXT DEFAULT 'email', -- 'email', 'linkedin', 'whatsapp'
  sender_email TEXT,
  sender_name TEXT,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Review flags
  requires_review BOOLEAN DEFAULT true,
  sentiment TEXT, -- 'positive', 'negative', 'neutral'

  -- ========================================
  -- HITL WORKFLOW FIELDS
  -- ========================================

  -- Workflow status
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'edited', 'refused'

  -- Review tracking
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  -- Message content
  ai_suggested_response TEXT, -- SAM's AI-generated draft
  final_message TEXT, -- Final message after HITL approval/editing
  draft_generated_at TIMESTAMPTZ,

  -- Priority and categorization
  priority TEXT DEFAULT 'normal', -- 'normal', 'urgent'

  -- Link to original email
  email_response_id UUID REFERENCES email_responses(id) ON DELETE SET NULL,

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add foreign key for prospect_id if workspace_prospects exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'workspace_prospects'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'fk_campaign_replies_prospect'
    ) THEN
      ALTER TABLE campaign_replies
        ADD CONSTRAINT fk_campaign_replies_prospect
        FOREIGN KEY (prospect_id)
        REFERENCES workspace_prospects(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_replies_campaign ON campaign_replies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_workspace ON campaign_replies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_prospect ON campaign_replies(prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_status ON campaign_replies(status);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_priority ON campaign_replies(priority, received_at DESC) WHERE requires_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_campaign_replies_reviewed_by ON campaign_replies(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_email_response ON campaign_replies(email_response_id);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_received_at ON campaign_replies(received_at DESC);

-- Enable RLS
ALTER TABLE campaign_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view replies in their workspaces" ON campaign_replies;
CREATE POLICY "Users can view replies in their workspaces"
  ON campaign_replies
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert replies in their workspaces" ON campaign_replies;
CREATE POLICY "Users can insert replies in their workspaces"
  ON campaign_replies
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update replies in their workspaces" ON campaign_replies;
CREATE POLICY "Users can update replies in their workspaces"
  ON campaign_replies
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Auto-update updated_at timestamp
DROP FUNCTION IF EXISTS update_campaign_replies_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_campaign_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_replies_updated_at ON campaign_replies;

CREATE TRIGGER campaign_replies_updated_at
  BEFORE UPDATE ON campaign_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_replies_updated_at();

-- Now add foreign key from message_outbox to campaign_replies (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_message_outbox_reply'
  ) THEN
    ALTER TABLE message_outbox
      ADD CONSTRAINT fk_message_outbox_reply
      FOREIGN KEY (reply_id)
      REFERENCES campaign_replies(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE campaign_replies IS 'Stores prospect replies to campaigns with HITL workflow for email-only approval';
COMMENT ON COLUMN campaign_replies.status IS 'HITL workflow status: pending, approved, edited, refused';
COMMENT ON COLUMN campaign_replies.final_message IS 'Final message content (SAM draft or HITL edited version)';
COMMENT ON COLUMN campaign_replies.ai_suggested_response IS 'SAM AI generated draft response';
COMMENT ON COLUMN campaign_replies.priority IS 'Reply priority: normal, urgent';
COMMENT ON COLUMN campaign_replies.sentiment IS 'Detected sentiment: positive, negative, neutral';
COMMENT ON COLUMN campaign_replies.requires_review IS 'Whether this reply requires HITL review';
