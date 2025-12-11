-- Create Slack two-way communication tables
-- December 11, 2025
-- Enables full bidirectional messaging with Slack

-- ============================================================================
-- TABLE 1: slack_channels - Map SAM campaigns/workspaces to Slack channels
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id VARCHAR(50) NOT NULL,           -- Slack channel ID (C0XXXXXXXXX)
  channel_name VARCHAR(255),                 -- #channel-name for display
  channel_type VARCHAR(20) DEFAULT 'public', -- 'public', 'private', 'dm'
  linked_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,          -- Default channel for workspace notifications
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each Slack channel can only be linked once per workspace
  UNIQUE(workspace_id, channel_id)
);

-- ============================================================================
-- TABLE 2: slack_messages - Store all inbound/outbound Slack messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_id VARCHAR(50) NOT NULL,           -- Slack channel ID
  thread_ts VARCHAR(50),                     -- Slack thread timestamp (for threading)
  message_ts VARCHAR(50) NOT NULL,           -- Slack message timestamp (unique ID)
  direction VARCHAR(10) NOT NULL,            -- 'inbound' or 'outbound'
  sender_type VARCHAR(20) NOT NULL,          -- 'user', 'bot', 'sam'
  sender_id VARCHAR(50),                     -- Slack user ID or bot ID
  sender_name VARCHAR(255),                  -- Display name
  content TEXT NOT NULL,                     -- Message content

  -- SAM AI processing fields
  sam_thread_id UUID,                        -- Link to SAM conversation thread
  ai_response TEXT,                          -- AI-generated response (if applicable)
  processed_at TIMESTAMP WITH TIME ZONE,     -- When SAM processed this message

  -- Metadata
  raw_event JSONB,                           -- Full Slack event payload
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each message is unique by workspace + message_ts
  UNIQUE(workspace_id, message_ts)
);

-- ============================================================================
-- TABLE 3: slack_user_mapping - Link Slack users to SAM workspace members
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slack_user_id VARCHAR(50) NOT NULL,        -- Slack user ID (U0XXXXXXXXX)
  slack_username VARCHAR(255),               -- @username
  slack_display_name VARCHAR(255),           -- Display name
  slack_email VARCHAR(255),                  -- Email (if available)
  sam_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Linked SAM user
  is_admin BOOLEAN DEFAULT false,            -- Slack workspace admin
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One mapping per Slack user per workspace
  UNIQUE(workspace_id, slack_user_id)
);

-- ============================================================================
-- TABLE 4: slack_app_config - Store Slack app credentials per workspace
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Slack App Credentials (from Slack App settings)
  slack_team_id VARCHAR(50),                 -- Slack team/workspace ID
  slack_team_name VARCHAR(255),              -- Slack workspace name
  bot_token TEXT,                            -- xoxb-xxx Bot User OAuth Token (encrypted)
  bot_user_id VARCHAR(50),                   -- Bot's Slack user ID

  -- OAuth tokens (for user-level actions if needed)
  access_token TEXT,                         -- xoxp-xxx User OAuth Token (encrypted)

  -- App configuration
  signing_secret TEXT,                       -- For request verification
  app_id VARCHAR(50),                        -- Slack App ID

  -- Features enabled
  features_enabled JSONB DEFAULT '{
    "notifications": true,
    "two_way_chat": true,
    "slash_commands": true,
    "interactive_buttons": true,
    "thread_replies": true
  }'::jsonb,

  -- Status
  status VARCHAR(20) DEFAULT 'pending',      -- 'pending', 'active', 'error', 'disconnected'
  last_verified_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One config per workspace
  UNIQUE(workspace_id)
);

-- ============================================================================
-- TABLE 5: slack_pending_actions - Queue for approval/reject actions from Slack
-- ============================================================================
CREATE TABLE IF NOT EXISTS slack_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,          -- 'approve_comment', 'reject_comment', 'approve_reply', etc.
  resource_type VARCHAR(50) NOT NULL,        -- 'comment', 'reply', 'campaign', 'prospect'
  resource_id UUID NOT NULL,                 -- ID of the resource to act on

  -- Slack context
  channel_id VARCHAR(50),
  message_ts VARCHAR(50),                    -- Original message with buttons
  user_id VARCHAR(50),                       -- Slack user who will act

  -- Action metadata
  action_data JSONB DEFAULT '{}',            -- Additional action-specific data
  expires_at TIMESTAMP WITH TIME ZONE,       -- When this action expires

  -- Status
  status VARCHAR(20) DEFAULT 'pending',      -- 'pending', 'completed', 'expired', 'cancelled'
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by VARCHAR(50),                  -- Slack user who completed

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_slack_channels_workspace ON slack_channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_channel ON slack_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_campaign ON slack_channels(linked_campaign_id);

CREATE INDEX IF NOT EXISTS idx_slack_messages_workspace ON slack_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_channel ON slack_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_slack_messages_thread ON slack_messages(thread_ts);
CREATE INDEX IF NOT EXISTS idx_slack_messages_direction ON slack_messages(direction);
CREATE INDEX IF NOT EXISTS idx_slack_messages_created ON slack_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_slack_user_mapping_workspace ON slack_user_mapping(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mapping_slack_user ON slack_user_mapping(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_user_mapping_sam_user ON slack_user_mapping(sam_user_id);

CREATE INDEX IF NOT EXISTS idx_slack_app_config_workspace ON slack_app_config(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_app_config_status ON slack_app_config(status);

CREATE INDEX IF NOT EXISTS idx_slack_pending_actions_workspace ON slack_pending_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_pending_actions_status ON slack_pending_actions(status);
CREATE INDEX IF NOT EXISTS idx_slack_pending_actions_expires ON slack_pending_actions(expires_at);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE slack_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_user_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_pending_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for slack_channels
CREATE POLICY "Users can view their workspace slack channels"
  ON slack_channels FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their workspace slack channels"
  ON slack_channels FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- RLS Policies for slack_messages
CREATE POLICY "Users can view their workspace slack messages"
  ON slack_messages FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their workspace slack messages"
  ON slack_messages FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- RLS Policies for slack_user_mapping
CREATE POLICY "Users can view their workspace slack user mappings"
  ON slack_user_mapping FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their workspace slack user mappings"
  ON slack_user_mapping FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- RLS Policies for slack_app_config
CREATE POLICY "Users can view their workspace slack app config"
  ON slack_app_config FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their workspace slack app config"
  ON slack_app_config FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- RLS Policies for slack_pending_actions
CREATE POLICY "Users can view their workspace slack pending actions"
  ON slack_pending_actions FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their workspace slack pending actions"
  ON slack_pending_actions FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT ALL ON slack_channels TO authenticated;
GRANT ALL ON slack_channels TO service_role;
GRANT ALL ON slack_messages TO authenticated;
GRANT ALL ON slack_messages TO service_role;
GRANT ALL ON slack_user_mapping TO authenticated;
GRANT ALL ON slack_user_mapping TO service_role;
GRANT ALL ON slack_app_config TO authenticated;
GRANT ALL ON slack_app_config TO service_role;
GRANT ALL ON slack_pending_actions TO authenticated;
GRANT ALL ON slack_pending_actions TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get or create a Slack channel mapping
CREATE OR REPLACE FUNCTION get_or_create_slack_channel(
  p_workspace_id UUID,
  p_channel_id VARCHAR(50),
  p_channel_name VARCHAR(255) DEFAULT NULL,
  p_channel_type VARCHAR(20) DEFAULT 'public'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try to find existing
  SELECT id INTO v_id FROM slack_channels
  WHERE workspace_id = p_workspace_id AND channel_id = p_channel_id;

  -- Create if not found
  IF v_id IS NULL THEN
    INSERT INTO slack_channels (workspace_id, channel_id, channel_name, channel_type)
    VALUES (p_workspace_id, p_channel_id, p_channel_name, p_channel_type)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log a Slack message
CREATE OR REPLACE FUNCTION log_slack_message(
  p_workspace_id UUID,
  p_channel_id VARCHAR(50),
  p_message_ts VARCHAR(50),
  p_direction VARCHAR(10),
  p_sender_type VARCHAR(20),
  p_content TEXT,
  p_sender_id VARCHAR(50) DEFAULT NULL,
  p_sender_name VARCHAR(255) DEFAULT NULL,
  p_thread_ts VARCHAR(50) DEFAULT NULL,
  p_raw_event JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO slack_messages (
    workspace_id, channel_id, message_ts, direction, sender_type,
    content, sender_id, sender_name, thread_ts, raw_event
  )
  VALUES (
    p_workspace_id, p_channel_id, p_message_ts, p_direction, p_sender_type,
    p_content, p_sender_id, p_sender_name, p_thread_ts, p_raw_event
  )
  ON CONFLICT (workspace_id, message_ts) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_or_create_slack_channel TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_slack_channel TO service_role;
GRANT EXECUTE ON FUNCTION log_slack_message TO authenticated;
GRANT EXECUTE ON FUNCTION log_slack_message TO service_role;
