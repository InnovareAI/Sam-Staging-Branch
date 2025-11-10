-- Delete All Test Campaigns and Related Data
-- WARNING: This will permanently delete all campaigns and prospects
-- Use with caution!

BEGIN;

-- Step 1: Delete campaign activity logs
DELETE FROM campaign_activity_log;

-- Step 2: Delete all campaign prospects
DELETE FROM campaign_prospects;

-- Step 3: Delete all campaigns
DELETE FROM campaigns;

-- Step 4: Verify deletions
SELECT 'Campaigns remaining:' as info, COUNT(*) as count FROM campaigns
UNION ALL
SELECT 'Prospects remaining:' as info, COUNT(*) as count FROM campaign_prospects
UNION ALL
SELECT 'Activity logs remaining:' as info, COUNT(*) as count FROM campaign_activity_log;

COMMIT;

-- Success message
SELECT '✅ All test campaigns deleted successfully!' as result;
