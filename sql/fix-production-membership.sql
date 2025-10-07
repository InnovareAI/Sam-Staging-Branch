-- Add missing workspace membership for tl@innovareai.com
-- This fixes the 401 error on /api/email-providers

INSERT INTO workspace_members (
  workspace_id,
  user_id,
  role
) VALUES (
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', -- InnovareAI Workspace
  'f6885ff3-deef-4781-8721-93011c990b1b', -- tl@innovareai.com
  'admin'
)
ON CONFLICT (workspace_id, user_id) DO UPDATE
SET role = 'admin';

-- Verify the membership was added
SELECT
  wm.id,
  wm.workspace_id,
  wm.user_id,
  wm.role,
  w.name as workspace_name
FROM workspace_members wm
JOIN workspaces w ON w.id = wm.workspace_id
WHERE wm.user_id = 'f6885ff3-deef-4781-8721-93011c990b1b'
  AND wm.workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
