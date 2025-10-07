-- Simplified migration: Create message_outbox table only
-- This migration works even if workspace_prospects and campaign_replies don't exist yet
-- Foreign key constraints will be added later when those tables are created

CREATE TABLE IF NOT EXISTS message_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

  -- Store prospect_id and reply_id as UUID without foreign keys for now
  prospect_id UUID, -- Will link to workspace_prospects when it exists
  reply_id UUID,    -- Will link to campaign_replies when it exists

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
COMMENT ON COLUMN message_outbox.prospect_id IS 'Links to workspace_prospects (no FK constraint - table may not exist)';
COMMENT ON COLUMN message_outbox.reply_id IS 'Links to campaign_replies (no FK constraint - table may not exist)';
