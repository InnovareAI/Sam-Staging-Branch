-- Query to see rate limits grouped by LinkedIn account
-- Shows which accounts are hitting rate limits

SELECT
  wa.account_name,
  wa.unipile_account_id,
  w.name as workspace_name,
  COUNT(CASE WHEN cp.status = 'rate_limited_cr' THEN 1 END) as cr_rate_limits,
  COUNT(CASE WHEN cp.status = 'rate_limited_message' THEN 1 END) as message_rate_limits,
  COUNT(CASE WHEN cp.status = 'rate_limited' THEN 1 END) as legacy_rate_limits,
  MAX(CASE 
    WHEN cp.status LIKE 'rate_limited%' 
    THEN cp.updated_at 
  END) as last_rate_limit,
  -- Calculate when each can be used again
  MAX(CASE 
    WHEN cp.status = 'rate_limited_cr' 
    THEN cp.updated_at + INTERVAL '24 hours'
    WHEN cp.status = 'rate_limited_message'
    THEN cp.updated_at + INTERVAL '1 hour'
  END) as available_after
FROM campaigns c
JOIN workspaces w ON w.id = c.workspace_id
JOIN workspace_accounts wa ON wa.workspace_id = w.id 
  AND wa.provider = 'linkedin'
LEFT JOIN campaign_prospects cp ON cp.campaign_id = c.id
  AND cp.status LIKE 'rate_limited%'
GROUP BY wa.account_name, wa.unipile_account_id, w.name
HAVING COUNT(CASE WHEN cp.status LIKE 'rate_limited%' THEN 1 END) > 0
ORDER BY last_rate_limit DESC;
