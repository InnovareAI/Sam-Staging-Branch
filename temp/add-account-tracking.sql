-- ============================================================================
-- Add Account Tracking to Campaign Prospects
-- ============================================================================
-- Allows us to see which LinkedIn account hit rate limits

-- Add column to store which Unipile account was used for each prospect
ALTER TABLE campaign_prospects 
ADD COLUMN IF NOT EXISTS unipile_account_id TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_account_status 
  ON campaign_prospects(unipile_account_id, status) 
  WHERE status LIKE 'rate_limited%';

-- Create view to see rate limits by account
CREATE OR REPLACE VIEW rate_limits_by_account AS
SELECT
  cp.unipile_account_id,
  wa.account_name,
  w.name as workspace_name,
  cp.status,
  COUNT(*) as prospect_count,
  MIN(cp.updated_at) as first_rate_limit,
  MAX(cp.updated_at) as last_rate_limit,
  -- Calculate when account will be available
  CASE 
    WHEN cp.status = 'rate_limited_cr' 
    THEN MAX(cp.updated_at) + INTERVAL '24 hours'
    WHEN cp.status = 'rate_limited_message'
    THEN MAX(cp.updated_at) + INTERVAL '1 hour'
    ELSE MAX(cp.updated_at) + INTERVAL '24 hours'
  END as available_after,
  -- Is it available now?
  CASE 
    WHEN cp.status = 'rate_limited_cr' 
    THEN MAX(cp.updated_at) + INTERVAL '24 hours' < NOW()
    WHEN cp.status = 'rate_limited_message'
    THEN MAX(cp.updated_at) + INTERVAL '1 hour' < NOW()
    ELSE MAX(cp.updated_at) + INTERVAL '24 hours' < NOW()
  END as is_available_now
FROM campaign_prospects cp
LEFT JOIN campaigns c ON c.id = cp.campaign_id
LEFT JOIN workspaces w ON w.id = c.workspace_id
LEFT JOIN workspace_accounts wa ON wa.unipile_account_id = cp.unipile_account_id
WHERE cp.status LIKE 'rate_limited%'
  AND cp.unipile_account_id IS NOT NULL
GROUP BY cp.unipile_account_id, wa.account_name, w.name, cp.status
ORDER BY last_rate_limit DESC;

-- Grant access
GRANT SELECT ON rate_limits_by_account TO authenticated;

-- Test the view
SELECT * FROM rate_limits_by_account;
