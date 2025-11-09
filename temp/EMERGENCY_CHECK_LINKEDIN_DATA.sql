-- ============================================================================
-- EMERGENCY: Check if LinkedIn connection data still exists
-- ============================================================================

-- Check if workspace_accounts data is still there (bypassing RLS using service role)
SELECT
  id,
  workspace_id,
  account_type,
  unipile_account_id,
  email,
  is_active,
  created_at
FROM workspace_accounts
ORDER BY created_at DESC;

-- Check if workspace_id is NULL for any accounts (this would cause them to be hidden)
SELECT
  'Accounts with NULL workspace_id' AS issue,
  COUNT(*) AS count
FROM workspace_accounts
WHERE workspace_id IS NULL;

-- Check if accounts exist but workspace_members don't match
SELECT
  wa.id,
  wa.workspace_id,
  wa.email,
  wa.account_type,
  CASE
    WHEN wa.workspace_id IS NULL THEN '❌ No workspace assigned'
    WHEN NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = wa.workspace_id
    ) THEN '❌ Workspace has no members'
    ELSE '✅ OK'
  END AS status
FROM workspace_accounts wa
ORDER BY status, wa.created_at DESC;
