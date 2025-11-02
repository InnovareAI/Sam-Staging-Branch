-- Find the campaign "20251101-IAI-test 10"
SELECT 
  c.id,
  c.name,
  c.status,
  c.campaign_type,
  c.workspace_id,
  COUNT(cp.id) as prospect_count
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.name LIKE '%20251101-IAI-test%'
GROUP BY c.id, c.name, c.status, c.campaign_type, c.workspace_id;
