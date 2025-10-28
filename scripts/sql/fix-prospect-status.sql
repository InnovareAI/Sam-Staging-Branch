-- Fix campaign prospects with 'new' status to 'approved' so they can be executed
-- This fixes prospects added before the status bug was fixed

UPDATE campaign_prospects
SET status = 'approved'
WHERE status = 'new'
  AND linkedin_url IS NOT NULL;

-- Show results
SELECT
  status,
  COUNT(*) as count,
  COUNT(linkedin_url) as with_linkedin_url
FROM campaign_prospects
GROUP BY status
ORDER BY status;
