-- Create message outbox table for queuing approved messages
-- This table stores messages awaiting delivery via email or LinkedIn

CREATE TABLE IF NOT EXISTS message_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES workspace_prospects(id) ON DELETE SET NULL,
  reply_id UUID, -- Links to campaign_replies if this is a reply

  -- Channel and content
  channel TEXT NOT NULL, -- 'email', 'linkedin', 'both'
  message_content TEXT NOT NULL,
  subject TEXT, -- For email messages

  -- Sending status
  status TEXT DEFAULT 'queued', -- 'queued', 'sending', 'sent', 'failed', 'cancelled'
  scheduled_send_time TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- External IDs
  external_message_id TEXT, -- Unipile or email provider message ID
  n8n_execution_id TEXT, -- N8N workflow execution ID

  -- Metadata
  metadata JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for reply_id (only if campaign_replies exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
  ) THEN
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
  END IF;
END $$;

-- Indexes for outbox table
CREATE INDEX IF NOT EXISTS idx_message_outbox_workspace ON message_outbox(workspace_id);
CREATE INDEX IF NOT EXISTS idx_message_outbox_campaign ON message_outbox(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_outbox_prospect ON message_outbox(prospect_id);
CREATE INDEX IF NOT EXISTS idx_message_outbox_reply ON message_outbox(reply_id);
CREATE INDEX IF NOT EXISTS idx_message_outbox_status ON message_outbox(status) WHERE status IN ('queued', 'sending');
CREATE INDEX IF NOT EXISTS idx_message_outbox_scheduled ON message_outbox(scheduled_send_time) WHERE status = 'queued';

-- RLS policies for message_outbox
ALTER TABLE message_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view outbox for their workspaces" ON message_outbox;
CREATE POLICY "Users can view outbox for their workspaces"
  ON message_outbox
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert to outbox" ON message_outbox;
CREATE POLICY "Users can insert to outbox"
  ON message_outbox
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update outbox in their workspaces" ON message_outbox;
CREATE POLICY "Users can update outbox in their workspaces"
  ON message_outbox
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Update campaign_replies table with HITL workflow fields
DO $$
BEGIN
  -- Add status column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN status TEXT DEFAULT 'pending'; -- 'pending', 'approved', 'edited', 'refused'
  END IF;

  -- Add reviewed_by column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  -- Add reviewed_at column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN reviewed_at TIMESTAMPTZ;
  END IF;

  -- Add final_message column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'final_message'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN final_message TEXT;
  END IF;

  -- Add ai_suggested_response column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'ai_suggested_response'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN ai_suggested_response TEXT;
  END IF;

  -- Add draft_generated_at column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'draft_generated_at'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN draft_generated_at TIMESTAMPTZ;
  END IF;

  -- Add priority column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'priority'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN priority TEXT DEFAULT 'normal'; -- 'normal', 'urgent'
  END IF;

  -- Add email_response_id column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'email_response_id'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN email_response_id UUID;
  END IF;

  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'campaign_replies'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE campaign_replies
      ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Add foreign key for email_response_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_campaign_replies_email_response'
  ) THEN
    IF EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'email_responses'
    ) THEN
      ALTER TABLE campaign_replies
        ADD CONSTRAINT fk_campaign_replies_email_response
        FOREIGN KEY (email_response_id)
        REFERENCES email_responses(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Indexes for campaign_replies new columns
CREATE INDEX IF NOT EXISTS idx_campaign_replies_status ON campaign_replies(status);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_priority ON campaign_replies(priority, received_at DESC) WHERE requires_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_campaign_replies_reviewed_by ON campaign_replies(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_campaign_replies_email_response ON campaign_replies(email_response_id);

-- Auto-update updated_at timestamp for message_outbox
DROP FUNCTION IF EXISTS update_message_outbox_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_message_outbox_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_outbox_updated_at ON message_outbox;

CREATE TRIGGER message_outbox_updated_at
  BEFORE UPDATE ON message_outbox
  FOR EACH ROW
  EXECUTE FUNCTION update_message_outbox_updated_at();

-- Comments
COMMENT ON TABLE message_outbox IS 'Queue for outbound messages (email, LinkedIn) awaiting delivery';
COMMENT ON COLUMN message_outbox.status IS 'Message delivery status: queued, sending, sent, failed, cancelled';
COMMENT ON COLUMN message_outbox.channel IS 'Delivery channel: email, linkedin, both';
COMMENT ON COLUMN message_outbox.reply_id IS 'Links to campaign_replies if this message is a reply to a prospect';
COMMENT ON COLUMN campaign_replies.status IS 'HITL workflow status: pending, approved, edited, refused';
COMMENT ON COLUMN campaign_replies.final_message IS 'Final message content (SAM draft or HITL edited version)';
COMMENT ON COLUMN campaign_replies.ai_suggested_response IS 'SAM AI generated draft response';
COMMENT ON COLUMN campaign_replies.priority IS 'Reply priority: normal, urgent';
