-- Drop ALL existing policies on linkedin_post_monitors
DROP POLICY IF EXISTS "Users can view monitors in their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can create monitors in their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can update monitors in their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can delete monitors in their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can view monitors in their
   workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can create monitors in
  their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can update monitors in
  their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can delete monitors in
  their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_monitors_select_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_monitors_insert_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_monitors_update_workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "linkedin_monitors_delete_workspace" ON linkedin_post_monitors;

-- Create clean policies (simple names)
CREATE POLICY "select_workspace_monitors"
ON linkedin_post_monitors
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "insert_workspace_monitors"
ON linkedin_post_monitors
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "update_workspace_monitors"
ON linkedin_post_monitors
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "delete_workspace_monitors"
ON linkedin_post_monitors
FOR DELETE
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
  )
);

-- Verify we have exactly 4 policies
SELECT COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'linkedin_post_monitors';

-- Show the policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'linkedin_post_monitors'
ORDER BY cmd;
