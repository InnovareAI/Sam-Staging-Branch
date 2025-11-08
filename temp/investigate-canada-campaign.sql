-- Investigation: Find all workspaces for tl@innovareai.com and Canada campaigns
-- Run this in Supabase SQL Editor

-- 1. Find user ID for tl@innovareai.com
SELECT
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'tl@innovareai.com';

-- 2. Find all workspaces for this user
SELECT
  wm.workspace_id,
  wm.role,
  w.name as workspace_name,
  w.client_code,
  w.created_at
FROM workspace_members wm
JOIN workspaces w ON wm.workspace_id = w.id
WHERE wm.user_id = (SELECT id FROM auth.users WHERE email = 'tl@innovareai.com')
ORDER BY w.created_at DESC;

-- 3. Find ALL campaigns with "Canada" in the name (across all workspaces)
SELECT
  c.id,
  c.name,
  c.workspace_id,
  c.status,
  c.created_at,
  w.name as workspace_name,
  w.client_code,
  -- Check if user has access to this workspace
  (
    SELECT COUNT(*)
    FROM workspace_members wm
    WHERE wm.workspace_id = c.workspace_id
    AND wm.user_id = (SELECT id FROM auth.users WHERE email = 'tl@innovareai.com')
  ) as user_has_access
FROM campaigns c
LEFT JOIN workspaces w ON c.workspace_id = w.id
WHERE LOWER(c.name) LIKE '%canada%'
ORDER BY c.created_at DESC;

-- 4. Check prospect_approval_sessions with "Canada" in campaign_name
SELECT
  pas.id,
  pas.campaign_name,
  pas.workspace_id,
  pas.created_at,
  w.name as workspace_name,
  w.client_code,
  (
    SELECT COUNT(*)
    FROM workspace_members wm
    WHERE wm.workspace_id = pas.workspace_id
    AND wm.user_id = (SELECT id FROM auth.users WHERE email = 'tl@innovareai.com')
  ) as user_has_access,
  (
    SELECT COUNT(*)
    FROM prospect_approval_data pad
    WHERE pad.session_id = pas.id
    AND pad.approval_status = 'approved'
  ) as approved_count
FROM prospect_approval_sessions pas
LEFT JOIN workspaces w ON pas.workspace_id = w.id
WHERE LOWER(pas.campaign_name) LIKE '%canada%'
ORDER BY pas.created_at DESC;

-- 5. Check if there are multiple workspaces with similar names
SELECT
  w.id,
  w.name,
  w.client_code,
  (
    SELECT COUNT(*)
    FROM workspace_members wm
    WHERE wm.workspace_id = w.id
  ) as member_count,
  (
    SELECT COUNT(*)
    FROM campaigns c
    WHERE c.workspace_id = w.id
  ) as campaign_count
FROM workspaces w
ORDER BY w.created_at DESC
LIMIT 20;
