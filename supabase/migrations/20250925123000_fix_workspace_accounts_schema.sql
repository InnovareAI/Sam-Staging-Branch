-- Align workspace_accounts schema with Supabase Auth workspace model
-- Ensures workspace_id uses UUID type and fixes RLS policies

BEGIN;

-- Drop any existing RLS policies prior to altering the column type
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'workspace_accounts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON workspace_accounts', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE workspace_accounts
  ALTER COLUMN workspace_id TYPE uuid USING workspace_id::uuid;

CREATE POLICY "workspace_accounts_select" ON workspace_accounts
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_accounts_insert" ON workspace_accounts
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_accounts_update" ON workspace_accounts
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_accounts_delete" ON workspace_accounts
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
    )
  );

COMMIT;
