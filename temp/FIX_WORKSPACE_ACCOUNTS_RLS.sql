-- ============================================================================
-- FIX: workspace_accounts RLS policies for authenticated users
-- ============================================================================
-- Issue: Policies are for 'public' role, but logged-in users are 'authenticated'
-- Result: Users can't see their LinkedIn connections
-- Fix: Add policies for authenticated users with workspace isolation
-- ============================================================================

-- Drop old public policies
DROP POLICY IF EXISTS "workspace_accounts_select" ON workspace_accounts;
DROP POLICY IF EXISTS "workspace_accounts_insert" ON workspace_accounts;
DROP POLICY IF EXISTS "workspace_accounts_update" ON workspace_accounts;
DROP POLICY IF EXISTS "workspace_accounts_delete" ON workspace_accounts;

-- Create new authenticated user policies with workspace isolation

-- Policy 1: Users can view accounts in their workspaces
CREATE POLICY "Users can view workspace accounts"
ON workspace_accounts
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 2: Users can create accounts in their workspaces
CREATE POLICY "Users can create workspace accounts"
ON workspace_accounts
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 3: Users can update accounts in their workspaces
CREATE POLICY "Users can update workspace accounts"
ON workspace_accounts
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 4: Users can delete accounts in their workspaces
CREATE POLICY "Users can delete workspace accounts"
ON workspace_accounts
FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 5: Service role has full access
CREATE POLICY "Service role full access on workspace_accounts"
ON workspace_accounts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- VERIFY THE FIX
-- ============================================================================

-- Check updated policies
SELECT
  policyname,
  cmd AS operation,
  roles,
  CASE
    WHEN cmd = 'SELECT' THEN 'Read access'
    WHEN cmd = 'INSERT' THEN 'Create access'
    WHEN cmd = 'UPDATE' THEN 'Update access'
    WHEN cmd = 'DELETE' THEN 'Delete access'
    WHEN cmd = 'ALL' THEN 'Full access'
    ELSE cmd
  END AS access_type
FROM pg_policies
WHERE tablename = 'workspace_accounts'
ORDER BY policyname;

-- Final verification
SELECT
  '✅ WORKSPACE_ACCOUNTS RLS FIXED' AS status,
  COUNT(*) AS policy_count,
  STRING_AGG(policyname, ', ') AS policies
FROM pg_policies
WHERE tablename = 'workspace_accounts';

-- ============================================================================
-- END OF FIX
-- ============================================================================
