-- ================================================================
-- COMPREHENSIVE LINKEDIN WORKSPACE SCHEMA FIX
-- Date: 2025-10-25
-- Purpose: Fix all LinkedIn/Workspace/User mapping inconsistencies
-- ================================================================

-- ================================================================
-- PART 1: FIX workspace_accounts.workspace_id TYPE MISMATCH
-- ================================================================
-- Problem: workspace_id is TEXT but should be UUID to match workspaces.id

-- Drop the unique constraint that includes workspace_id
ALTER TABLE workspace_accounts DROP CONSTRAINT IF EXISTS workspace_accounts_workspace_id_account_type_account_identifi_key;

-- Convert workspace_id from TEXT to UUID
ALTER TABLE workspace_accounts
  ALTER COLUMN workspace_id TYPE UUID USING workspace_id::UUID;

-- Add proper foreign key constraint
ALTER TABLE workspace_accounts
  DROP CONSTRAINT IF EXISTS workspace_accounts_workspace_id_fkey;

ALTER TABLE workspace_accounts
  ADD CONSTRAINT workspace_accounts_workspace_id_fkey
  FOREIGN KEY (workspace_id)
  REFERENCES workspaces(id)
  ON DELETE CASCADE;

-- Recreate the unique constraint
ALTER TABLE workspace_accounts
  ADD CONSTRAINT workspace_accounts_workspace_type_identifier_unique
  UNIQUE(workspace_id, account_type, account_identifier);

-- ================================================================
-- PART 2: ADD workspace_id TO user_unipile_accounts
-- ================================================================
-- Problem: user_unipile_accounts has no workspace_id, making workspace filtering hard

-- Add workspace_id column (nullable for now to allow backfill)
ALTER TABLE user_unipile_accounts
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Create index for workspace queries
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
-- PART 3: FIX linkedin_contacts RLS POLICIES (CLERK REMOVAL)
-- ================================================================
-- Problem: RLS still references Clerk auth (clerk_id) which was removed

-- Drop all existing policies on linkedin_contacts
DROP POLICY IF EXISTS "Users can access own linkedin contacts" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_user_access" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_select" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_insert" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_update" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_contacts_delete" ON linkedin_contacts;

-- Fix user_id foreign key reference (should be auth.users, not users table)
ALTER TABLE linkedin_contacts DROP CONSTRAINT IF EXISTS linkedin_contacts_user_id_fkey;
ALTER TABLE linkedin_contacts
  ADD CONSTRAINT linkedin_contacts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

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
-- PART 4: FIX linkedin_discovery_jobs RLS POLICIES
-- ================================================================
-- Problem: Same Clerk issue

-- Drop old policies
DROP POLICY IF EXISTS "Users can access own discovery jobs" ON linkedin_discovery_jobs;

-- Fix foreign key
ALTER TABLE linkedin_discovery_jobs DROP CONSTRAINT IF EXISTS linkedin_discovery_jobs_user_id_fkey;
ALTER TABLE linkedin_discovery_jobs
  ADD CONSTRAINT linkedin_discovery_jobs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

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
-- PART 5: UPDATE RLS POLICIES ON user_unipile_accounts
-- ================================================================
-- Add workspace-aware policies

DROP POLICY IF EXISTS "Users can manage their own unipile accounts" ON user_unipile_accounts;
DROP POLICY IF EXISTS "Users can view own account associations" ON user_unipile_accounts;

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
-- PART 6: UPDATE ATOMIC ACCOUNT ASSOCIATION FUNCTION
-- ================================================================
-- Fix the atomic association function to handle workspace_id

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
    p_workspace_id,
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
'Atomically associates a LinkedIn account with both user_unipile_accounts and workspace_accounts tables. Handles workspace_id properly for multi-tenant support.';

-- ================================================================
-- PART 7: CREATE HELPER VIEW FOR LINKEDIN ACCOUNT STATUS
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

COMMENT ON VIEW v_linkedin_account_status IS
'Shows the mapping status between user_unipile_accounts and workspace_accounts for LinkedIn accounts. Helps identify orphaned records.';

-- ================================================================
-- PART 8: CREATE FUNCTION TO SYNC ORPHANED ACCOUNTS
-- ================================================================

CREATE OR REPLACE FUNCTION sync_orphaned_linkedin_accounts()
RETURNS TABLE (
  unipile_account_id TEXT,
  action TEXT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Find user_unipile_accounts without workspace_accounts
  RETURN QUERY
  WITH orphaned_user_accounts AS (
    SELECT
      uua.id,
      uua.user_id,
      uua.workspace_id,
      uua.unipile_account_id,
      uua.account_name,
      uua.account_email,
      uua.linkedin_public_identifier
    FROM user_unipile_accounts uua
    LEFT JOIN workspace_accounts wa
      ON uua.unipile_account_id = wa.unipile_account_id
    WHERE uua.platform = 'LINKEDIN'
      AND wa.id IS NULL
      AND uua.workspace_id IS NOT NULL
  )
  INSERT INTO workspace_accounts (
    workspace_id,
    user_id,
    account_type,
    account_identifier,
    account_name,
    unipile_account_id,
    connection_status,
    is_active
  )
  SELECT
    workspace_id,
    user_id,
    'linkedin',
    COALESCE(account_email, linkedin_public_identifier, unipile_account_id),
    account_name,
    unipile_account_id,
    'connected',
    true
  FROM orphaned_user_accounts
  ON CONFLICT (unipile_account_id) DO NOTHING
  RETURNING
    unipile_account_id,
    'created_workspace_account'::TEXT as action,
    'Synced from user_unipile_accounts'::TEXT as details;
END;
$$;

COMMENT ON FUNCTION sync_orphaned_linkedin_accounts IS
'Syncs orphaned user_unipile_accounts records to workspace_accounts. Run after migration to fix existing data.';

-- ================================================================
-- PART 9: RUN IMMEDIATE SYNC FOR EXISTING DATA
-- ================================================================

-- Sync orphaned accounts immediately
SELECT * FROM sync_orphaned_linkedin_accounts();

-- ================================================================
-- VERIFICATION QUERIES (FOR MANUAL TESTING)
-- ================================================================

-- Check for unmapped accounts
-- SELECT * FROM v_linkedin_account_status WHERE mapping_status != 'fully_mapped';

-- Check workspace_id type
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'workspace_accounts' AND column_name = 'workspace_id';

-- Check RLS policies
-- SELECT tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('linkedin_contacts', 'user_unipile_accounts', 'workspace_accounts');

-- ================================================================
-- END OF MIGRATION
-- ================================================================
