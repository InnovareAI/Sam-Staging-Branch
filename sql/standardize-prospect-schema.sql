-- Standardize prospect schema across workspace_prospects and campaign_prospects
-- This ensures ONE consistent naming convention across ALL workspaces
-- Migration: standardize-prospect-schema.sql

-- Step 1: Rename columns in workspace_prospects to match campaign_prospects
ALTER TABLE workspace_prospects
  RENAME COLUMN linkedin_profile_url TO linkedin_url;

ALTER TABLE workspace_prospects
  RENAME COLUMN email_address TO email;

ALTER TABLE workspace_prospects
  RENAME COLUMN job_title TO title;

-- Step 2: Update indexes to use new column names
DROP INDEX IF EXISTS idx_workspace_prospects_linkedin_url;
CREATE INDEX idx_workspace_prospects_linkedin_url ON workspace_prospects(linkedin_url);

-- Step 3: Update unique constraint to use new column name
ALTER TABLE workspace_prospects
  DROP CONSTRAINT IF EXISTS workspace_prospects_workspace_id_linkedin_profile_url_key;

ALTER TABLE workspace_prospects
  ADD CONSTRAINT workspace_prospects_workspace_id_linkedin_url_key
  UNIQUE (workspace_id, linkedin_url);

-- Step 4: Update any views or functions that reference old column names
-- Update resolve_campaign_linkedin_ids function
CREATE OR REPLACE FUNCTION resolve_campaign_linkedin_ids(
  p_campaign_id UUID,
  p_user_id UUID
) RETURNS TABLE (
  prospect_id UUID,
  linkedin_url TEXT,
  linkedin_internal_id TEXT,
  resolution_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.prospect_id,
    wp.linkedin_url,  -- Changed from linkedin_profile_url
    lc.linkedin_internal_id,
    CASE
      WHEN lc.linkedin_internal_id IS NOT NULL THEN 'found'
      ELSE 'not_found'
    END as resolution_status
  FROM campaign_prospects cp
  JOIN workspace_prospects wp ON cp.prospect_id = wp.id
  LEFT JOIN linkedin_contacts lc ON wp.linkedin_url = lc.linkedin_profile_url
  WHERE cp.campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Verification query to confirm changes
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'workspace_prospects'
  AND column_name IN ('linkedin_url', 'email', 'title', 'linkedin_profile_url', 'email_address', 'job_title')
ORDER BY column_name;
