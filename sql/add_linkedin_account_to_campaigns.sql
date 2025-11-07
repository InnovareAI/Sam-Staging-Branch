-- Add linkedin_account_id to campaigns table
-- This allows campaigns to specify which LinkedIn account to use for sending connection requests

-- Add the column (nullable initially for backwards compatibility)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS linkedin_account_id UUID REFERENCES workspace_accounts(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_linkedin_account
ON campaigns(linkedin_account_id);

-- Add comment
COMMENT ON COLUMN campaigns.linkedin_account_id IS
'The specific LinkedIn account to use for this campaign. If NULL, uses workspace default (first active account).';

-- Update existing campaigns to use the first LinkedIn account in their workspace
-- This maintains current behavior for existing campaigns
UPDATE campaigns c
SET linkedin_account_id = (
  SELECT wa.id
  FROM workspace_accounts wa
  WHERE wa.workspace_id = c.workspace_id
    AND wa.account_type = 'linkedin'
    AND wa.is_active = true
  ORDER BY wa.created_at ASC
  LIMIT 1
)
WHERE c.linkedin_account_id IS NULL
  AND EXISTS (
    SELECT 1 FROM workspace_accounts wa
    WHERE wa.workspace_id = c.workspace_id
      AND wa.account_type = 'linkedin'
      AND wa.is_active = true
  );

-- Verify the update
SELECT
  c.name,
  c.workspace_id,
  wa.account_name as linkedin_account,
  wa.unipile_account_id
FROM campaigns c
LEFT JOIN workspace_accounts wa ON wa.id = c.linkedin_account_id
WHERE c.created_at > NOW() - INTERVAL '7 days'
ORDER BY c.created_at DESC
LIMIT 10;
