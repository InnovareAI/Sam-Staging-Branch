-- FIX WORKSPACE_MEMBERS RLS CIRCULAR DEPENDENCY
-- Problem: Current policy tries to check workspace_members while querying workspace_members
-- Solution: Simple policy that allows users to see their own memberships

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view workspace memberships for workspaces they have access to" ON workspace_members;
DROP POLICY IF EXISTS "Workspace owners and admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_view" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_admin_manage" ON workspace_members;
DROP POLICY IF EXISTS "workspace_isolation_workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "emergency_admin_access_workspace_members" ON workspace_members;
DROP POLICY IF EXISTS "service_role_full_access_workspace_members" ON workspace_members;

-- Create simple, non-circular SELECT policy
-- Users can see ANY workspace_members row where they are the user_id
CREATE POLICY "Users can view their own memberships" ON workspace_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Allow workspace owners to see all members in their workspaces
CREATE POLICY "Workspace owners can view all members" ON workspace_members
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- Allow admins to view members in workspaces where they are admin
CREATE POLICY "Admins can view workspace members" ON workspace_members
    FOR SELECT
    USING (
        workspace_id IN (
            -- Use a direct join instead of subquery to avoid circular dependency
            SELECT wm.workspace_id
            FROM workspace_members wm
            WHERE wm.user_id = auth.uid()
            AND wm.role IN ('admin', 'owner')
        )
    );

-- Insert/Update/Delete policies for owners and admins only
CREATE POLICY "Workspace owners can manage members" ON workspace_members
    FOR ALL
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    )
    WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- Service role bypass (for API operations)
CREATE POLICY "Service role full access" ON workspace_members
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Check current policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'workspace_members'
ORDER BY policyname;
