-- Migration: Create linkedin_invitation_withdrawals table
-- Created: December 16, 2025
-- Purpose: Track withdrawn LinkedIn invitations for analytics and re-targeting

-- Table to track invitation withdrawals
CREATE TABLE IF NOT EXISTS linkedin_invitation_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  unipile_account_id TEXT NOT NULL,
  invitation_id TEXT NOT NULL,
  invited_user_name TEXT,
  invited_user_id TEXT,
  invitation_date TIMESTAMPTZ,
  days_pending INTEGER,
  withdrawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- For re-targeting
  re_invited_at TIMESTAMPTZ,
  re_invite_campaign_id UUID REFERENCES campaigns(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invitation_withdrawals_workspace
  ON linkedin_invitation_withdrawals(workspace_id);

CREATE INDEX IF NOT EXISTS idx_invitation_withdrawals_account
  ON linkedin_invitation_withdrawals(unipile_account_id);

CREATE INDEX IF NOT EXISTS idx_invitation_withdrawals_withdrawn_at
  ON linkedin_invitation_withdrawals(withdrawn_at);

CREATE INDEX IF NOT EXISTS idx_invitation_withdrawals_invited_user
  ON linkedin_invitation_withdrawals(invited_user_id);

-- RLS policies
ALTER TABLE linkedin_invitation_withdrawals ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage invitation withdrawals"
  ON linkedin_invitation_withdrawals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow workspace members to read their withdrawals
CREATE POLICY "Workspace members can view withdrawals"
  ON linkedin_invitation_withdrawals
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Comment
COMMENT ON TABLE linkedin_invitation_withdrawals IS 'Tracks LinkedIn invitations that were automatically withdrawn after being pending too long (default 21 days)';
COMMENT ON COLUMN linkedin_invitation_withdrawals.days_pending IS 'Number of days the invitation was pending before withdrawal';
COMMENT ON COLUMN linkedin_invitation_withdrawals.re_invited_at IS 'If the prospect was re-invited in a later campaign';
