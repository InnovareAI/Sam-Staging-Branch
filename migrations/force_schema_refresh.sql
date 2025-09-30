-- Force Supabase to refresh schema cache by making a harmless change
-- Add a comment to the current_workspace_id column

COMMENT ON COLUMN users.current_workspace_id IS 'User''s currently active workspace for context isolation';

-- Verify the column exists and is accessible
SELECT 
  'users' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name = 'current_workspace_id';

-- Show all users with their workspace
SELECT 
  email,
  current_workspace_id,
  (SELECT name FROM workspaces WHERE id = users.current_workspace_id) as workspace_name
FROM users
ORDER BY email;