-- Debug script to check campaign prospects
-- Campaign: 20251109-CLI-CSV Upload

-- Step 1: Find the campaign ID
SELECT
  id,
  name,
  created_at,
  status,
  workspace_id
FROM campaigns
WHERE name LIKE '%20251109-CLI-CSV Upload%'
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Count prospects in campaign_prospects (replace CAMPAIGN_ID with actual ID from above)
-- SELECT COUNT(*) as prospect_count
-- FROM campaign_prospects
-- WHERE campaign_id = 'REPLACE_WITH_CAMPAIGN_ID';

-- Step 3: Show actual prospects in campaign (replace CAMPAIGN_ID)
-- SELECT
--   id,
--   first_name,
--   last_name,
--   linkedin_url,
--   status,
--   created_at
-- FROM campaign_prospects
-- WHERE campaign_id = 'REPLACE_WITH_CAMPAIGN_ID'
-- LIMIT 10;

-- Step 4: Check approved prospects that might not be linked yet
SELECT
  COUNT(*) as approved_not_in_campaign
FROM prospect_approval_data
WHERE approval_status = 'approved'
  AND prospect_id NOT IN (
    SELECT DISTINCT prospect_id
    FROM campaign_prospects
    WHERE prospect_id IS NOT NULL
  );

-- Step 5: Check recent prospect_approval_data entries
SELECT
  prospect_id,
  name,
  title,
  company_name,
  approval_status,
  created_at,
  contact->>'linkedin_url' as linkedin_url
FROM prospect_approval_data
WHERE approval_status = 'approved'
ORDER BY created_at DESC
LIMIT 10;
