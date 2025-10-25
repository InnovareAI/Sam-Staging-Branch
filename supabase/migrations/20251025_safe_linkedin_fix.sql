-- ================================================================
-- SAFE LINKEDIN SCHEMA FIX - Non-Breaking Changes Only
-- Date: 2025-10-25
-- Purpose: Fix only what's broken, don't touch what works
-- ================================================================

-- ================================================================
-- PART 1: ADD workspace_id TO user_unipile_accounts (SAFE)
-- ================================================================
-- This won't break existing Unipile integration

-- Add workspace_id column (nullable to allow existing records)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_unipile_accounts'
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE user_unipile_accounts
      ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

    RAISE NOTICE 'Added workspace_id column to user_unipile_accounts';
  ELSE
    RAISE NOTICE 'workspace_id column already exists in user_unipile_accounts';
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_workspace_id
  ON user_unipile_accounts(workspace_id);

-- Backfill workspace_id from workspace_members for existing records
UPDATE user_unipile_accounts uua
SET workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = uua.user_id
  LIMIT 1
)
WHERE workspace_id IS NULL
  AND user_id IS NOT NULL;

-- ================================================================
-- PART 2: FIX linkedin_contacts RLS POLICIES (CRITICAL)
-- ================================================================
-- Old policies reference Clerk auth which is gone

-- Drop all existing policies on linkedin_contacts
DROP POLICY IF EXISTS "Users can access own linkedin contacts" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_user_access" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_select" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_insert" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_update" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_delete" ON linkedin_contacts;

-- Create new Supabase Auth-based RLS policies
CREATE POLICY "linkedin_contacts_select" ON linkedin_contacts
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_contacts_insert" ON linkedin_contacts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_contacts_update" ON linkedin_contacts
  FOR UPDATE USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_contacts_delete" ON linkedin_contacts
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ================================================================
-- PART 3: FIX linkedin_discovery_jobs RLS POLICIES
-- ================================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can access own discovery jobs" ON linkedin_discovery_jobs;
DROP POLICY IF EXISTS "linkedin_discovery_jobs_select" ON linkedin_discovery_jobs;
DROP POLICY IF EXISTS "linkedin_discovery_jobs_insert" ON linkedin_discovery_jobs;
DROP POLICY IF EXISTS "linkedin_discovery_jobs_update" ON linkedin_discovery_jobs;
DROP POLICY IF EXISTS "linkedin_discovery_jobs_delete" ON linkedin_discovery_jobs;

-- Create new policies
CREATE POLICY "linkedin_discovery_jobs_select" ON linkedin_discovery_jobs
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_discovery_jobs_insert" ON linkedin_discovery_jobs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "linkedin_discovery_jobs_update" ON linkedin_discovery_jobs
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "linkedin_discovery_jobs_delete" ON linkedin_discovery_jobs
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ================================================================
-- PART 4: UPDATE user_unipile_accounts RLS POLICIES
-- ================================================================
-- Add workspace support while keeping existing policies functional

DROP POLICY IF EXISTS "Users can manage their own unipile accounts" ON user_unipile_accounts;
DROP POLICY IF EXISTS "Users can view own account associations" ON user_unipile_accounts;
DROP POLICY IF EXISTS "user_unipile_accounts_select" ON user_unipile_accounts;
DROP POLICY IF EXISTS "user_unipile_accounts_insert" ON user_unipile_accounts;
DROP POLICY IF EXISTS "user_unipile_accounts_update" ON user_unipile_accounts;
DROP POLICY IF EXISTS "user_unipile_accounts_delete" ON user_unipile_accounts;

-- New policies with workspace support
CREATE POLICY "user_unipile_accounts_select" ON user_unipile_accounts
  FOR SELECT USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "user_unipile_accounts_insert" ON user_unipile_accounts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "user_unipile_accounts_update" ON user_unipile_accounts
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "user_unipile_accounts_delete" ON user_unipile_accounts
  FOR DELETE USING (
    user_id = auth.uid()
  );

-- ================================================================
-- PART 5: UPDATE ATOMIC ASSOCIATION FUNCTION
-- ================================================================

CREATE OR REPLACE FUNCTION associate_linkedin_account_atomic(
  p_user_id UUID,
  p_workspace_id UUID,
  p_unipile_account_id TEXT,
  p_account_name TEXT,
  p_account_email TEXT,
  p_linkedin_public_identifier TEXT,
  p_linkedin_profile_url TEXT,
  p_connection_status TEXT DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_account_id UUID;
  v_workspace_account_id UUID;
  v_result JSONB;
BEGIN
  -- 1. Insert/update user_unipile_accounts (user ownership)
  INSERT INTO user_unipile_accounts (
    user_id,
    workspace_id,
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
    p_workspace_id,
    p_unipile_account_id,
    'LINKEDIN',
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
    workspace_id = EXCLUDED.workspace_id,
    account_name = EXCLUDED.account_name,
    account_email = EXCLUDED.account_email,
    linkedin_public_identifier = EXCLUDED.linkedin_public_identifier,
    linkedin_profile_url = EXCLUDED.linkedin_profile_url,
    connection_status = EXCLUDED.connection_status,
    updated_at = NOW()
  RETURNING id INTO v_user_account_id;

  -- 2. Insert/update workspace_accounts (workspace access for campaigns)
  INSERT INTO workspace_accounts (
    workspace_id,
    user_id,
    account_type,
    account_identifier,
    account_name,
    unipile_account_id,
    connection_status,
    connected_at,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    p_workspace_id::TEXT, -- Keep as TEXT to match existing schema
    p_user_id,
    'linkedin',
    COALESCE(p_account_email, p_linkedin_public_identifier, p_unipile_account_id),
    p_account_name,
    p_unipile_account_id,
    CASE
      WHEN p_connection_status = 'active' THEN 'connected'
      ELSE 'pending'
    END,
    CASE WHEN p_connection_status = 'active' THEN NOW() ELSE NULL END,
    CASE WHEN p_connection_status = 'active' THEN TRUE ELSE FALSE END,
    NOW(),
    NOW()
  )
  ON CONFLICT (unipile_account_id)
  DO UPDATE SET
    workspace_id = EXCLUDED.workspace_id,
    user_id = EXCLUDED.user_id,
    account_identifier = EXCLUDED.account_identifier,
    account_name = EXCLUDED.account_name,
    connection_status = EXCLUDED.connection_status,
    connected_at = EXCLUDED.connected_at,
    is_active = EXCLUDED.is_active,
    updated_at = NOW()
  RETURNING id INTO v_workspace_account_id;

  -- Return result
  v_result := jsonb_build_object(
    'success', true,
    'user_account_id', v_user_account_id,
    'workspace_account_id', v_workspace_account_id,
    'message', 'LinkedIn account associated successfully'
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION associate_linkedin_account_atomic IS
'Atomically associates a LinkedIn account with both user_unipile_accounts and workspace_accounts tables.';

-- ================================================================
-- PART 6: CREATE HELPER VIEW
-- ================================================================

CREATE OR REPLACE VIEW v_linkedin_account_status AS
SELECT
  uua.id as user_account_id,
  uua.user_id,
  uua.workspace_id,
  uua.unipile_account_id,
  uua.account_name,
  uua.account_email,
  uua.linkedin_public_identifier,
  uua.linkedin_profile_url,
  uua.connection_status as user_connection_status,
  wa.id as workspace_account_id,
  wa.connection_status as workspace_connection_status,
  wa.is_active as workspace_account_active,
  CASE
    WHEN uua.id IS NOT NULL AND wa.id IS NOT NULL THEN 'fully_mapped'
    WHEN uua.id IS NOT NULL AND wa.id IS NULL THEN 'missing_workspace_account'
    WHEN uua.id IS NULL AND wa.id IS NOT NULL THEN 'missing_user_account'
    ELSE 'unknown'
  END as mapping_status,
  uua.created_at,
  uua.updated_at
FROM user_unipile_accounts uua
FULL OUTER JOIN workspace_accounts wa
  ON uua.unipile_account_id = wa.unipile_account_id
WHERE uua.platform = 'LINKEDIN' OR wa.account_type = 'linkedin';

-- ================================================================
-- END OF SAFE MIGRATION
-- ================================================================
