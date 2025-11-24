-- Database Cleanup Script
-- Removes old/failed campaigns and fixes data integrity issues
-- Run this after fixing auth client bug

-- ===================================================================
-- 1. BACKUP DATA FIRST (just in case)
-- ===================================================================
CREATE TABLE IF NOT EXISTS campaigns_backup_20241124 AS
SELECT * FROM campaigns
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

CREATE TABLE IF NOT EXISTS campaign_prospects_backup_20241124 AS
SELECT cp.* FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
WHERE c.workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

-- ===================================================================
-- 2. DELETE EMPTY/FAILED CAMPAIGNS (no prospects or all failed)
-- ===================================================================
DELETE FROM campaigns
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
AND id IN (
  SELECT c.id
  FROM campaigns c
  LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
  WHERE c.workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
  GROUP BY c.id
  HAVING
    COUNT(cp.id) = 0  -- No prospects
    OR COUNT(CASE WHEN cp.status = 'failed' THEN 1 END) = COUNT(cp.id)  -- All failed
);

-- ===================================================================
-- 3. DELETE ORPHANED CAMPAIGN PROSPECTS (campaign no longer exists)
-- ===================================================================
DELETE FROM campaign_prospects
WHERE NOT EXISTS (
  SELECT 1 FROM campaigns WHERE campaigns.id = campaign_prospects.campaign_id
);

-- ===================================================================
-- 4. DELETE ORPHANED SEND QUEUE ENTRIES
-- ===================================================================
DELETE FROM send_queue
WHERE NOT EXISTS (
  SELECT 1 FROM campaigns WHERE campaigns.id = send_queue.campaign_id
);

-- ===================================================================
-- 5. DELETE OLD FAILED PROSPECTS (older than 7 days)
-- ===================================================================
DELETE FROM campaign_prospects
WHERE status = 'failed'
AND created_at < NOW() - INTERVAL '7 days';

-- ===================================================================
-- 6. CLEANUP DUPLICATE WORKSPACE PROSPECTS (keep newest)
-- ===================================================================
DELETE FROM workspace_prospects
WHERE id IN (
  SELECT wp1.id
  FROM workspace_prospects wp1
  JOIN workspace_prospects wp2 ON
    wp1.linkedin_profile_url = wp2.linkedin_profile_url
    AND wp1.workspace_id = wp2.workspace_id
    AND wp1.id < wp2.id  -- Delete older one
  WHERE wp1.workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
);

-- ===================================================================
-- 7. SUMMARY OF CLEANUP
-- ===================================================================
SELECT
  'Active campaigns' as metric,
  COUNT(*) as count
FROM campaigns
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
AND status = 'active'
UNION ALL
SELECT
  'Total campaign prospects' as metric,
  COUNT(*) as count
FROM campaign_prospects cp
JOIN campaigns c ON cp.campaign_id = c.id
WHERE c.workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
UNION ALL
SELECT
  'Pending in send queue' as metric,
  COUNT(*) as count
FROM send_queue sq
JOIN campaigns c ON sq.campaign_id = c.id
WHERE c.workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'
AND sq.status = 'pending'
UNION ALL
SELECT
  'Workspace prospects' as metric,
  COUNT(*) as count
FROM workspace_prospects
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
