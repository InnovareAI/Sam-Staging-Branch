-- ============================================================================
-- Add current_workspace_id column to users table
-- This is required for LinkedIn integration and workspace context
-- ============================================================================

-- Step 1: Add the column if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_workspace_id UUID;

-- Step 2: Add foreign key constraint
ALTER TABLE users
ADD CONSTRAINT fk_users_current_workspace 
FOREIGN KEY (current_workspace_id) 
REFERENCES workspaces(id) 
ON DELETE SET NULL;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_current_workspace_id 
ON users(current_workspace_id);

-- Step 4: Set current_workspace_id for all existing users based on their workspace memberships
-- For users with memberships, set to their first workspace (by joined_at date)
UPDATE users u
SET current_workspace_id = (
  SELECT wm.workspace_id
  FROM workspace_members wm
  WHERE wm.user_id = u.id
  ORDER BY wm.joined_at ASC
  LIMIT 1
)
WHERE current_workspace_id IS NULL
AND EXISTS (
  SELECT 1 
  FROM workspace_members wm 
  WHERE wm.user_id = u.id
);

-- Step 5: Verify the results
SELECT 
  u.email,
  u.current_workspace_id,
  w.name as workspace_name,
  w.slug as workspace_slug
FROM users u
LEFT JOIN workspaces w ON u.current_workspace_id = w.id
ORDER BY u.email;

-- Step 6: Show summary
SELECT 
  COUNT(*) as total_users,
  COUNT(current_workspace_id) as users_with_workspace,
  COUNT(*) - COUNT(current_workspace_id) as users_without_workspace
FROM users;