-- User Unipile Accounts Association Table
-- This table tracks which Unipile accounts belong to which SAM users
-- CRITICAL: This prevents showing all accounts to all users

CREATE TABLE IF NOT EXISTS user_unipile_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unipile_account_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('LINKEDIN', 'EMAIL', 'WHATSAPP')),
  account_name TEXT,
  account_email TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT DEFAULT 'active' CHECK (connection_status IN ('active', 'disconnected', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one user can't claim the same Unipile account multiple times
  UNIQUE(unipile_account_id),
  -- Ensure one user can't have duplicate LinkedIn identifiers
  UNIQUE(user_id, linkedin_public_identifier) WHERE linkedin_public_identifier IS NOT NULL
);

-- Enable RLS
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own account associations
CREATE POLICY "Users can view own account associations"
  ON user_unipile_accounts
  FOR ALL
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);
CREATE INDEX idx_user_unipile_accounts_unipile_id ON user_unipile_accounts(unipile_account_id);
CREATE INDEX idx_user_unipile_accounts_platform ON user_unipile_accounts(platform);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_unipile_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_user_unipile_accounts_updated_at
  BEFORE UPDATE ON user_unipile_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_unipile_accounts_updated_at();