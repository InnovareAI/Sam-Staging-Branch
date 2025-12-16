-- ============================================
-- Migration: Create OAuth States Table
-- For OAuth flow CSRF protection (Calendly, Cal.com, etc.)
-- Created: December 16, 2025
-- ============================================

-- OAuth state tracking for CSRF protection during OAuth flows
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT UNIQUE NOT NULL,           -- Unique state parameter
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                -- 'calendly', 'calcom', etc.
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Auto-cleanup expired states (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role can manage all states
CREATE POLICY oauth_states_service_role ON oauth_states
  FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own workspace states
CREATE POLICY oauth_states_workspace_access ON oauth_states
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE oauth_states IS 'Temporary OAuth state storage for CSRF protection during OAuth flows';

-- ============================================
-- Update workspace_accounts for OAuth tokens
-- ============================================

-- Add columns for OAuth token storage (if not exist)
ALTER TABLE workspace_accounts
  ADD COLUMN IF NOT EXISTS scheduling_url TEXT,
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Add unique constraint for workspace + account_type (for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_accounts_workspace_type_unique'
  ) THEN
    ALTER TABLE workspace_accounts
      ADD CONSTRAINT workspace_accounts_workspace_type_unique
      UNIQUE (workspace_id, account_type);
  END IF;
END $$;

COMMENT ON COLUMN workspace_accounts.scheduling_url IS 'User scheduling URL (Calendly, Cal.com)';
COMMENT ON COLUMN workspace_accounts.access_token IS 'OAuth access token (encrypted in production)';
COMMENT ON COLUMN workspace_accounts.refresh_token IS 'OAuth refresh token (encrypted in production)';
COMMENT ON COLUMN workspace_accounts.token_expires_at IS 'When the access token expires';
