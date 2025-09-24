-- Create workspace_accounts table for LinkedIn integration
-- Execute this in Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS workspace_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('linkedin', 'email', 'twitter', 'facebook')),
  account_identifier TEXT NOT NULL,
  account_name TEXT,
  unipile_account_id TEXT,
  platform_account_id TEXT,
  connection_status TEXT DEFAULT 'pending' CHECK (connection_status IN ('pending', 'connected', 'failed', 'needs_verification', 'disconnected')),
  connected_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  account_metadata JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '{}',
  limitations JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, account_type, account_identifier),
  UNIQUE(unipile_account_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_accounts_workspace ON workspace_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_user ON workspace_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_type ON workspace_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_status ON workspace_accounts(connection_status);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_unipile ON workspace_accounts(unipile_account_id);

ALTER TABLE workspace_accounts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workspace_accounts' 
    AND policyname = 'Users can access accounts in their workspace'
  ) THEN
    CREATE POLICY "Users can access accounts in their workspace" ON workspace_accounts
      FOR ALL USING (
        workspace_id IN (
          SELECT wm.workspace_id 
          FROM workspace_members wm 
          WHERE wm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_workspace_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workspace_accounts_updated_at
  BEFORE UPDATE ON workspace_accounts
  FOR EACH ROW EXECUTE FUNCTION update_workspace_accounts_updated_at();

CREATE OR REPLACE FUNCTION validate_workspace_account_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unipile_account_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM workspace_accounts 
      WHERE unipile_account_id = NEW.unipile_account_id 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Unipile account ID % is already in use', NEW.unipile_account_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_workspace_account_uniqueness
  BEFORE INSERT OR UPDATE ON workspace_accounts
  FOR EACH ROW EXECUTE FUNCTION validate_workspace_account_uniqueness();