-- Check Real Data in Production Database

-- 1. Count workspaces
SELECT 'Workspaces' as table_name, COUNT(*) as count FROM workspaces;

-- 2. Count users
SELECT 'Users' as table_name, COUNT(*) as count FROM users;

-- 3. Show sample workspaces
SELECT 
  id,
  name,
  slug,
  created_at,
  owner_id
FROM workspaces
ORDER BY created_at DESC
LIMIT 5;

-- 4. Show sample users
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  subscription_status,
  current_workspace_id
FROM users
ORDER BY created_at DESC
LIMIT 10;

-- 5. Count workspace members
SELECT 
  'Workspace Members' as table_name, 
  COUNT(*) as count 
FROM workspace_members;

-- 6. User subscription status breakdown
SELECT 
  subscription_status,
  COUNT(*) as user_count
FROM users
GROUP BY subscription_status
ORDER BY user_count DESC;

-- 7. Users by last sign in
SELECT 
  CASE 
    WHEN last_sign_in_at IS NULL THEN 'Never signed in'
    WHEN last_sign_in_at > NOW() - INTERVAL '7 days' THEN 'Active (7d)'
    WHEN last_sign_in_at > NOW() - INTERVAL '30 days' THEN 'Active (30d)'
    ELSE 'Inactive'
  END as activity,
  COUNT(*) as user_count
FROM users
GROUP BY activity
ORDER BY user_count DESC;
