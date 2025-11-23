-- Enable RLS on linkedin_post_monitors table
ALTER TABLE linkedin_post_monitors ENABLE ROW LEVEL SECURITY;

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
