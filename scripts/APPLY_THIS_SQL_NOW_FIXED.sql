-- ============================================================================
-- FIX DUPLICATE LINKEDIN POSTS - APPLY THIS SQL IN SUPABASE (UUID FIXED)
-- ============================================================================
-- Date: November 24, 2025
-- Issue: Duplicate posts showing in UI
-- Action: Copy ALL of this SQL and run in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
-- ============================================================================

-- ============================================================================
-- STEP 1: CLEAN UP EXISTING DUPLICATES (FIXED FOR UUID)
-- ============================================================================
-- This keeps the oldest post (by created_at) for each URL and deletes the rest

DELETE FROM linkedin_posts_discovered
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY share_url, workspace_id
        ORDER BY created_at ASC
      ) as rn
    FROM linkedin_posts_discovered
  ) sub
  WHERE rn > 1
);

-- Also clean up duplicates by social_id if any exist
DELETE FROM linkedin_posts_discovered
WHERE social_id IS NOT NULL
  AND id IN (
    SELECT id
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY social_id, workspace_id
          ORDER BY created_at ASC
        ) as rn
      FROM linkedin_posts_discovered
      WHERE social_id IS NOT NULL
    ) sub
    WHERE rn > 1
  );

-- ============================================================================
-- STEP 2: APPLY DUPLICATE PREVENTION MIGRATION
-- ============================================================================

-- Drop existing indexes if they exist (safe to run multiple times)
DROP INDEX IF EXISTS linkedin_posts_discovered_share_url_workspace_idx;
DROP INDEX IF EXISTS linkedin_posts_discovered_social_id_workspace_idx;
DROP INDEX IF EXISTS linkedin_posts_discovered_monitor_url_idx;

-- Add unique index on share_url per workspace
-- Prevents the same LinkedIn post URL from being stored twice
CREATE UNIQUE INDEX linkedin_posts_discovered_share_url_workspace_idx
ON linkedin_posts_discovered (share_url, workspace_id);

-- Add unique index on social_id per workspace
-- Prevents the same LinkedIn post ID from being stored twice
CREATE UNIQUE INDEX linkedin_posts_discovered_social_id_workspace_idx
ON linkedin_posts_discovered (social_id, workspace_id)
WHERE social_id IS NOT NULL;

-- Add check constraint to ensure at least one identifier exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'linkedin_posts_discovered_identifier_check'
  ) THEN
    ALTER TABLE linkedin_posts_discovered
    ADD CONSTRAINT linkedin_posts_discovered_identifier_check
    CHECK (share_url IS NOT NULL OR social_id IS NOT NULL);
  END IF;
END $$;

-- Create index for faster duplicate checks during discovery
CREATE INDEX IF NOT EXISTS linkedin_posts_discovered_monitor_url_idx
ON linkedin_posts_discovered (monitor_id, share_url);

-- Add helpful comments to indexes
COMMENT ON INDEX linkedin_posts_discovered_share_url_workspace_idx
IS 'Prevents duplicate posts by URL within the same workspace';

COMMENT ON INDEX linkedin_posts_discovered_social_id_workspace_idx
IS 'Prevents duplicate posts by social ID within the same workspace';

-- ============================================================================
-- STEP 3: VERIFY FIX (SHOULD RETURN 0 DUPLICATES)
-- ============================================================================

SELECT
  'Duplicates by URL' as check_type,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT share_url, workspace_id, COUNT(*) as cnt
  FROM linkedin_posts_discovered
  GROUP BY share_url, workspace_id
  HAVING COUNT(*) > 1
) sub

UNION ALL

SELECT
  'Duplicates by social_id' as check_type,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT social_id, workspace_id, COUNT(*) as cnt
  FROM linkedin_posts_discovered
  WHERE social_id IS NOT NULL
  GROUP BY social_id, workspace_id
  HAVING COUNT(*) > 1
) sub;

-- Expected output: Both counts should be 0
-- If you see "0 rows" that also means success (no duplicates found)

-- ============================================================================
-- DONE!
-- ============================================================================
-- ✅ Duplicates cleaned up
-- ✅ Unique constraints added
-- ✅ Future duplicates prevented
--
-- Next: Refresh your UI - posts should now appear only once
-- ============================================================================
