-- Enable RLS on linkedin_post_monitors table
ALTER TABLE linkedin_post_monitors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view monitors in their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can create monitors in their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can update monitors in their workspace" ON linkedin_post_monitors;
DROP POLICY IF EXISTS "Users can delete monitors in their workspace" ON linkedin_post_monitors;

-- Policy: Users can view monitors in their workspace
CREATE POLICY "Users can view monitors in their workspace"
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

-- Policy: Users can create monitors in their workspace
CREATE POLICY "Users can create monitors in their workspace"
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

-- Policy: Users can update monitors in their workspace
CREATE POLICY "Users can update monitors in their workspace"
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

-- Policy: Users can delete monitors in their workspace
CREATE POLICY "Users can delete monitors in their workspace"
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

-- Verify RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'linkedin_post_monitors';

-- Verify policies created
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'linkedin_post_monitors';
