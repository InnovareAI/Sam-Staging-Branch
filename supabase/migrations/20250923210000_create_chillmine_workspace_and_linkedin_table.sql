-- Create ChillMine workspace and LinkedIn authentication table
-- Combined migration for both requirements

-- First, create the user_unipile_accounts table for LinkedIn authentication
CREATE TABLE IF NOT EXISTS user_unipile_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unipile_account_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'LINKEDIN',
  account_name TEXT,
  account_email TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_unipile_account_id ON user_unipile_accounts(unipile_account_id);
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_platform ON user_unipile_accounts(platform);

-- Enable Row Level Security
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "Users can manage their own unipile accounts" ON user_unipile_accounts;
CREATE POLICY "Users can manage their own unipile accounts" ON user_unipile_accounts 
  FOR ALL USING (auth.uid() = user_id);

-- Create helper function for associations
CREATE OR REPLACE FUNCTION create_user_association(
  p_user_id UUID,
  p_unipile_account_id TEXT,
  p_platform TEXT,
  p_account_name TEXT,
  p_account_email TEXT,
  p_linkedin_public_identifier TEXT,
  p_linkedin_profile_url TEXT,
  p_connection_status TEXT
) RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  INSERT INTO user_unipile_accounts (
    user_id,
    unipile_account_id,
    platform,
    account_name,
    account_email,
    linkedin_public_identifier,
    linkedin_profile_url,
    connection_status,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_unipile_account_id,
    p_platform,
    p_account_name,
    p_account_email,
    p_linkedin_public_identifier,
    p_linkedin_profile_url,
    p_connection_status,
    NOW(),
    NOW()
  )
  ON CONFLICT (unipile_account_id) 
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    account_name = EXCLUDED.account_name,
    account_email = EXCLUDED.account_email,
    linkedin_public_identifier = EXCLUDED.linkedin_public_identifier,
    linkedin_profile_url = EXCLUDED.linkedin_profile_url,
    connection_status = EXCLUDED.connection_status,
    updated_at = NOW()
  RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now create the ChillMine workspace
-- First get the owner ID (tl@innovareai.com)
DO $$
DECLARE
    tl_user_id UUID;
    chillmine_workspace_id UUID;
BEGIN
    -- Get tl@innovareai.com user ID
    SELECT id INTO tl_user_id 
    FROM auth.users 
    WHERE email = 'tl@innovareai.com';
    
    -- Only proceed if user exists
    IF tl_user_id IS NOT NULL THEN
        -- Check if ChillMine workspace already exists
        IF NOT EXISTS (SELECT 1 FROM workspaces WHERE name ILIKE '%chillmine%') THEN
            -- Create ChillMine workspace
            INSERT INTO workspaces (name, slug, owner_id, created_at, updated_at)
            VALUES (
                'ChillMine Workspace',
                'chillmine-workspace', 
                tl_user_id,
                '2025-09-01T00:00:00.000Z',
                NOW()
            )
            RETURNING id INTO chillmine_workspace_id;
            
            -- Add owner as member
            INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
            VALUES (chillmine_workspace_id, tl_user_id, 'owner', NOW(), NOW());
            
            RAISE NOTICE 'Created ChillMine workspace with ID: %', chillmine_workspace_id;
        ELSE
            RAISE NOTICE 'ChillMine workspace already exists';
        END IF;
    ELSE
        RAISE NOTICE 'User tl@innovareai.com not found - cannot create ChillMine workspace';
    END IF;
END $$;

-- Add comments
COMMENT ON TABLE user_unipile_accounts IS 'Links SAM AI users to their Unipile LinkedIn accounts for authentication and messaging';
COMMENT ON FUNCTION create_user_association IS 'Helper function to create or update user-Unipile account associations';