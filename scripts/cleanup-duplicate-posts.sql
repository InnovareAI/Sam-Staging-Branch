-- Cleanup Duplicate LinkedIn Posts
-- Run this BEFORE applying migration 012-prevent-duplicate-posts.sql
-- Created: 2025-11-24

-- Step 1: Check for duplicates by share_url
SELECT
  share_url,
  workspace_id,
  COUNT(*) as duplicate_count
FROM linkedin_posts_discovered
GROUP BY share_url, workspace_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Check for duplicates by social_id
SELECT
  social_id,
  workspace_id,
  COUNT(*) as duplicate_count
FROM linkedin_posts_discovered
WHERE social_id IS NOT NULL
GROUP BY social_id, workspace_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 3: Delete duplicate posts (keep only the oldest one by created_at)
-- IMPORTANT: This will delete duplicates. Review the SELECT queries above first!

-- Delete duplicate posts by share_url (keep the oldest)
DELETE FROM linkedin_posts_discovered
WHERE id NOT IN (
  SELECT MIN(id)
  FROM linkedin_posts_discovered
  GROUP BY share_url, workspace_id
);

-- Delete duplicate posts by social_id (keep the oldest, only if social_id is not null)
DELETE FROM linkedin_posts_discovered
WHERE social_id IS NOT NULL
  AND id NOT IN (
    SELECT MIN(id)
    FROM linkedin_posts_discovered
    WHERE social_id IS NOT NULL
    GROUP BY social_id, workspace_id
  );

-- Step 4: Verify no duplicates remain
SELECT 'Duplicates by URL' as check_type, COUNT(*) as remaining_duplicates
FROM (
  SELECT share_url, workspace_id, COUNT(*) as cnt
  FROM linkedin_posts_discovered
  GROUP BY share_url, workspace_id
  HAVING COUNT(*) > 1
) sub

UNION ALL

SELECT 'Duplicates by social_id' as check_type, COUNT(*) as remaining_duplicates
FROM (
  SELECT social_id, workspace_id, COUNT(*) as cnt
  FROM linkedin_posts_discovered
  WHERE social_id IS NOT NULL
  GROUP BY social_id, workspace_id
  HAVING COUNT(*) > 1
) sub;

-- Expected output: Both counts should be 0
