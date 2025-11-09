-- FIX WORKSPACE_MEMBERS RLS CIRCULAR DEPENDENCY - V2
-- Drops ALL policies first, then creates clean new ones

-- Step 1: Drop ALL existing policies on workspace_members
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'workspace_members'
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON workspace_members', pol.policyname);
    END LOOP;
END $$;

-- Step 2: Create simple, non-circular SELECT policy
-- Users can see ANY workspace_members row where they are the user_id
CREATE POLICY "Users can view their own memberships" ON workspace_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Step 3: Allow workspace owners to see all members in their workspaces
CREATE POLICY "Workspace owners can view all members" ON workspace_members
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- Step 4: Allow admins to view members in workspaces where they are admin
CREATE POLICY "Admins can view workspace members" ON workspace_members
    FOR SELECT
    USING (
        workspace_id IN (
            SELECT wm.workspace_id
            FROM workspace_members wm
            WHERE wm.user_id = auth.uid()
            AND wm.role IN ('admin', 'owner')
        )
    );

-- Step 5: Insert/Update/Delete policies for owners only
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

-- Step 6: Service role bypass (for API operations)
CREATE POLICY "Service role full access" ON workspace_members
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Step 7: Verify RLS is enabled
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Step 8: Show final policies
SELECT
    policyname,
    cmd,
    roles::text,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'workspace_members'
ORDER BY policyname;
