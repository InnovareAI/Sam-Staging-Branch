-- ================================================================
-- LINKEDIN FIX - ONLY WHAT EXISTS
-- Date: 2025-10-25
-- ================================================================

-- ================================================================
-- PART 1: ADD workspace_id TO user_unipile_accounts
-- ================================================================

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
    RAISE NOTICE 'workspace_id column already exists';
  END IF;
END $$;

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_workspace_id
  ON user_unipile_accounts(workspace_id);

-- Backfill workspace_id from workspace_members
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
-- PART 2: UPDATE user_unipile_accounts RLS POLICIES
-- ================================================================

DROP POLICY IF EXISTS "Users can manage their own unipile accounts" ON user_unipile_accounts;
DROP POLICY IF EXISTS "Users can view own account associations" ON user_unipile_accounts;
DROP POLICY IF EXISTS "user_unipile_accounts_select" ON user_unipile_accounts;
DROP POLICY IF EXISTS "user_unipile_accounts_insert" ON user_unipile_accounts;
DROP POLICY IF EXISTS "user_unipile_accounts_update" ON user_unipile_accounts;
DROP POLICY IF EXISTS "user_unipile_accounts_delete" ON user_unipile_accounts;

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
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_unipile_accounts_update" ON user_unipile_accounts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "user_unipile_accounts_delete" ON user_unipile_accounts
  FOR DELETE USING (user_id = auth.uid());

-- ================================================================
-- PART 3: CREATE HELPER VIEW
-- ================================================================

CREATE OR REPLACE VIEW v_linkedin_account_status AS
SELECT
  uua.id as user_account_id,
  uua.user_id,
  uua.workspace_id,
  uua.unipile_account_id,
  uua.account_name,
  uua.platform,
  uua.connection_status as user_connection_status,
  wa.id as workspace_account_id,
  wa.connection_status as workspace_connection_status,
  wa.is_active as workspace_account_active,
  CASE
    WHEN uua.id IS NOT NULL AND wa.id IS NOT NULL THEN 'fully_mapped'
    WHEN uua.id IS NOT NULL AND wa.id IS NULL THEN 'missing_workspace_account'
    WHEN uua.id IS NULL AND wa.id IS NOT NULL THEN 'missing_user_account'
    ELSE 'unknown'
  END as mapping_status
FROM user_unipile_accounts uua
FULL OUTER JOIN workspace_accounts wa
  ON uua.unipile_account_id = wa.unipile_account_id;

-- ================================================================
-- END
-- ================================================================

SELECT 'Migration completed successfully' as status;
