-- Check the Canada campaign and its workspace
-- Find campaigns with "Canada" in the name
SELECT
  c.id,
  c.name,
  c.workspace_id,
  c.status,
  c.created_at,
  w.name as workspace_name,
  w.client_code,
  (
    SELECT COUNT(*)
    FROM workspace_members wm
    WHERE wm.workspace_id = c.workspace_id
  ) as member_count
FROM campaigns c
LEFT JOIN workspaces w ON c.workspace_id = w.id
WHERE LOWER(c.name) LIKE '%canada%'
ORDER BY c.created_at DESC;

-- Check if there are any prospects in campaign_prospects without workspace filtering
SELECT
  cp.id,
  cp.campaign_id,
  cp.first_name,
  cp.last_name,
  c.name as campaign_name,
  c.workspace_id,
  w.name as workspace_name
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
LEFT JOIN workspaces w ON c.workspace_id = w.id
WHERE c.name LIKE '%Canada%'
LIMIT 10;
