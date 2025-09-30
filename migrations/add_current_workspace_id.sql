-- Add current_workspace_id column to users table
-- This tracks the user's currently active workspace context

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_users_current_workspace_id ON users(current_workspace_id);

-- Set current_workspace_id for existing users based on their workspace memberships
-- For users with memberships, set to their first workspace
UPDATE users u
SET current_workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = u.id
  ORDER BY wm.created_at ASC
  LIMIT 1
)
WHERE current_workspace_id IS NULL
AND EXISTS (
  SELECT 1 
  FROM workspace_members wm 
  WHERE wm.user_id = u.id
);

-- Show results
SELECT 
  COUNT(*) as total_users,
  COUNT(current_workspace_id) as users_with_workspace,
  COUNT(*) - COUNT(current_workspace_id) as users_without_workspace
FROM users;