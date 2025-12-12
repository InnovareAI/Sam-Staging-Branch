-- Migration: 045-create-slack-pending-installations.sql
-- Description: Store pending Slack installations from App Directory
--              These are installations that need to be linked to a SAM workspace
-- Created: 2025-12-12

-- Table to store pending Slack app installations that haven't been linked to a SAM workspace yet
-- This happens when users install the Slack app directly from Slack App Directory
CREATE TABLE IF NOT EXISTS slack_pending_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slack_team_id TEXT NOT NULL UNIQUE,  -- Slack workspace ID
    slack_team_name TEXT,                 -- Slack workspace name for display
    bot_token TEXT NOT NULL,              -- The xoxb- bot token
    bot_user_id TEXT,                     -- The bot user ID in Slack
    authed_user_id TEXT,                  -- The Slack user who installed the app
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'expired')),
    linked_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,  -- Set when linked
    linked_at TIMESTAMPTZ,                -- When it was linked to a workspace
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,               -- Pending installations expire after 24 hours
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup by Slack team
CREATE INDEX IF NOT EXISTS idx_slack_pending_slack_team_id ON slack_pending_installations(slack_team_id);

-- Index for finding pending installations that need cleanup
CREATE INDEX IF NOT EXISTS idx_slack_pending_status_expires ON slack_pending_installations(status, expires_at);

-- Enable RLS
ALTER TABLE slack_pending_installations ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (needed for OAuth callback)
CREATE POLICY "Service role full access" ON slack_pending_installations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE slack_pending_installations IS 'Stores pending Slack installations from App Directory that need to be linked to a SAM workspace';
COMMENT ON COLUMN slack_pending_installations.slack_team_id IS 'Unique Slack workspace ID (T...)';
COMMENT ON COLUMN slack_pending_installations.bot_token IS 'Bot OAuth token (xoxb-...) - encrypted at rest';
COMMENT ON COLUMN slack_pending_installations.authed_user_id IS 'Slack user ID who authorized the installation';
COMMENT ON COLUMN slack_pending_installations.expires_at IS 'Pending installations expire 24 hours after creation';
