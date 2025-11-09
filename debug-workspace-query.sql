-- Debug: Check what the service role query should return
-- This simulates the exact query in workspace/list API

SELECT workspace_id, user_id, role, status
FROM workspace_members
WHERE user_id = 'f6885ff3-deef-4781-8721-93011c990b1b'
  AND status = 'active';

-- This should return ONLY 1 row (IA1)
-- If it returns 12 rows, then you have 12 memberships in the database
-- and we need to DELETE the unauthorized ones
