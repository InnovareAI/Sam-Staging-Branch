-- User Unipile Accounts Association Table
-- This ensures users only see their own LinkedIn accounts for privacy

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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraints
ALTER TABLE user_unipile_accounts ADD CONSTRAINT IF NOT EXISTS unique_unipile_account_id UNIQUE (unipile_account_id);

-- Enable RLS
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own account associations
DROP POLICY IF EXISTS "Users can view own account associations" ON user_unipile_accounts;
CREATE POLICY "Users can view own account associations"
  ON user_unipile_accounts
  FOR ALL
  USING (auth.uid() = user_id);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_unipile_id ON user_unipile_accounts(unipile_account_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_platform ON user_unipile_accounts(platform);

-- Create partial unique index for LinkedIn identifiers
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_linkedin_unique 
  ON user_unipile_accounts(user_id, linkedin_public_identifier) 
  WHERE linkedin_public_identifier IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_unipile_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_user_unipile_accounts_updated_at ON user_unipile_accounts;
CREATE TRIGGER trigger_update_user_unipile_accounts_updated_at
  BEFORE UPDATE ON user_unipile_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_unipile_accounts_updated_at();