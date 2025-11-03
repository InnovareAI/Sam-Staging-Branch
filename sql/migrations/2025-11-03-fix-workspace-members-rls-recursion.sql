-- Fix infinite recursion in workspace_members RLS policies
-- The issue: policies that query workspace_members to check access to workspace_members create circular dependency

-- Step 1: Temporarily disable RLS to regain access
ALTER TABLE workspace_members DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "workspace_members_select_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_policy" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_policy" ON workspace_members;
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace members can see their own membership" ON workspace_members;

-- Step 3: Create simple, non-recursive policies
-- Policy 1: Users can see their own memberships (no recursion - only checks auth.uid())
CREATE POLICY "Users can see their own workspace memberships"
ON workspace_members FOR SELECT
USING (user_id = auth.uid());

-- Policy 2: Service role can see all members (for admin operations)
CREATE POLICY "Service role can manage all members"
ON workspace_members FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Note: INSERT/UPDATE/DELETE policies removed to avoid recursion
-- These operations should be done via service role or application logic
-- Users can only view their own memberships

-- Step 4: Re-enable RLS
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify the fix
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'workspace_members'
ORDER BY policyname;
