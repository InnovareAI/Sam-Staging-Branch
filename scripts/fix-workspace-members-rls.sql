-- Fix RLS policy for workspace_members table
-- Allow users to read their own memberships

-- Create policy for users to read their own workspace memberships
CREATE POLICY "Users can read their own workspace memberships"
ON workspace_members
FOR SELECT
USING (user_id = auth.uid());

-- Verify the policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'workspace_members';
