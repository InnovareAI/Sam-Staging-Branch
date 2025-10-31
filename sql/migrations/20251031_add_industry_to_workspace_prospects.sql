-- Add missing fields to workspace_prospects
-- Date: October 31, 2025
-- Purpose: Store industry and company LinkedIn URL for BrightData enrichment

-- Add industry column to workspace_prospects table
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS industry TEXT;

-- Add company_linkedin_url column for BrightData enrichment
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_industry
ON workspace_prospects(workspace_id, industry)
WHERE industry IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_company_linkedin
ON workspace_prospects(workspace_id, company_linkedin_url)
WHERE company_linkedin_url IS NOT NULL;

-- Add comments
COMMENT ON COLUMN workspace_prospects.industry IS 'Industry or market segment of the prospect (from LinkedIn data)';
COMMENT ON COLUMN workspace_prospects.company_linkedin_url IS 'Company LinkedIn page URL (enriched by BrightData)';

-- Verify the columns were added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'workspace_prospects'
        AND column_name = 'industry'
    ) AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'workspace_prospects'
        AND column_name = 'company_linkedin_url'
    ) THEN
        RAISE NOTICE 'SUCCESS: industry and company_linkedin_url columns added to workspace_prospects';
    ELSE
        RAISE EXCEPTION 'FAILED: columns were not added';
    END IF;
END $$;
