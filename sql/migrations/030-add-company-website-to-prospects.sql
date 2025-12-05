-- Add company_website column to campaign_prospects
-- December 5, 2025

ALTER TABLE campaign_prospects 
ADD COLUMN IF NOT EXISTS company_website TEXT;

-- Add index for lookups
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_company_website 
ON campaign_prospects(company_website) 
WHERE company_website IS NOT NULL;

-- Also add to workspace_prospects if it exists
ALTER TABLE workspace_prospects 
ADD COLUMN IF NOT EXISTS company_website TEXT;

COMMENT ON COLUMN campaign_prospects.company_website IS 'Company website URL for the prospect';
COMMENT ON COLUMN workspace_prospects.company_website IS 'Company website URL for the prospect';
