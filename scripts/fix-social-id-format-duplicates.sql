-- Fix social_id format duplicates
-- Problem: Same post stored with both "7398622250960044032" and "urn:li:activity:7398622250960044032"
-- Solution: Normalize all social_ids to URN format, delete duplicates

-- ============================================================================
-- STEP 1: Find all posts with number-only social_id that have a URN equivalent
-- ============================================================================
SELECT
  'Posts with number-only social_id that have URN duplicates:' as info,
  COUNT(*) as count
FROM linkedin_posts_discovered p1
WHERE p1.social_id !~ '^urn:'  -- Doesn't start with "urn:"
  AND p1.social_id ~ '^[0-9]+$'  -- Is all numbers
  AND EXISTS (
    SELECT 1 FROM linkedin_posts_discovered p2
    WHERE p2.social_id = 'urn:li:activity:' || p1.social_id
      AND p2.workspace_id = p1.workspace_id
  );

-- ============================================================================
-- STEP 2: Delete number-only social_id posts that have URN equivalents
-- ============================================================================
-- This keeps the URN format (more reliable) and deletes the number-only format

DELETE FROM linkedin_posts_discovered
WHERE id IN (
  SELECT p1.id
  FROM linkedin_posts_discovered p1
  WHERE p1.social_id !~ '^urn:'  -- Doesn't start with "urn:"
    AND p1.social_id ~ '^[0-9]+$'  -- Is all numbers
    AND EXISTS (
      SELECT 1 FROM linkedin_posts_discovered p2
      WHERE p2.social_id = 'urn:li:activity:' || p1.social_id
        AND p2.workspace_id = p1.workspace_id
    )
);

-- ============================================================================
-- STEP 3: Normalize remaining number-only social_ids to URN format
-- ============================================================================
-- Convert any remaining number-only social_ids to URN format

UPDATE linkedin_posts_discovered
SET social_id = 'urn:li:activity:' || social_id
WHERE social_id !~ '^urn:'  -- Doesn't start with "urn:"
  AND social_id ~ '^[0-9]+$';  -- Is all numbers

-- ============================================================================
-- STEP 4: Verify - check for remaining duplicates
-- ============================================================================
SELECT
  'Remaining duplicates by social_id:' as check_type,
  COUNT(*) as duplicate_count
FROM (
  SELECT social_id, COUNT(*) as cnt
  FROM linkedin_posts_discovered
  GROUP BY social_id
  HAVING COUNT(*) > 1
) sub;

-- Expected output: 0 duplicates

-- ============================================================================
-- STEP 5: Update the unique constraint to be more robust
-- ============================================================================
-- Drop the existing unique constraint on social_id
DROP INDEX IF EXISTS linkedin_posts_discovered_social_id_workspace_idx;

-- Recreate it without the WHERE clause (enforce uniqueness for all posts)
CREATE UNIQUE INDEX linkedin_posts_discovered_social_id_workspace_idx
ON linkedin_posts_discovered (social_id, workspace_id);

COMMENT ON INDEX linkedin_posts_discovered_social_id_workspace_idx
IS 'Prevents duplicate posts by normalized social_id (URN format) within the same workspace';

-- ============================================================================
-- DONE!
-- ============================================================================
-- ✅ Duplicates with different social_id formats deleted
-- ✅ All social_ids normalized to URN format
-- ✅ Unique constraint updated
--
-- Next: Update API code to always extract URN format from Apify responses
-- ============================================================================
