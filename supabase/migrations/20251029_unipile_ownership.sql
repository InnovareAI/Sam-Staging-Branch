-- Add Unipile account ownership tracking
-- This tracks which LinkedIn account (via Unipile) found/added each prospect

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS added_by_unipile_account TEXT;

COMMENT ON COLUMN campaign_prospects.added_by_unipile_account IS
'Unipile account ID that found/added this prospect. LinkedIn TOS: prospects can only be messaged by the Unipile account that found them.';

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_unipile_account
ON campaign_prospects(added_by_unipile_account);

-- Also add to workspace_prospects for consistency
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS added_by_unipile_account TEXT;

COMMENT ON COLUMN workspace_prospects.added_by_unipile_account IS
'Unipile account ID that found/added this prospect. LinkedIn TOS: prospects can only be messaged by the Unipile account that found them.';

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_unipile_account
ON workspace_prospects(added_by_unipile_account);
