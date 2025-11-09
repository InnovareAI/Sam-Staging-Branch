-- Check workspace memberships for user f6885ff3-deef-4781-8721-93011c990b1b (tl@innovareai.com)
-- Run this in Supabase SQL Editor to see what workspaces this user has access to

SELECT
  w.id,
  w.name,
  w.slug,
  wm.role,
  wm.status,
  w.created_at
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = 'f6885ff3-deef-4781-8721-93011c990b1b'
ORDER BY w.name;
