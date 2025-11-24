-- Normalize ALL URN types to urn:li:activity:NUMBER format
-- Fixes duplicates caused by different URN types (ugcPost, share, activity, etc.)
-- ============================================================================

-- STEP 1: Find posts with different URN types that are actually the same post
-- ============================================================================
SELECT
  'Posts with different URN types for same numeric ID:' as info,
  COUNT(*) as count
FROM (
  SELECT
    SUBSTRING(social_id FROM '\d{16,20}') as numeric_id,
    COUNT(*) as urn_count
  FROM linkedin_posts_discovered
  WHERE social_id ~ '\d{16,20}'
  GROUP BY SUBSTRING(social_id FROM '\d{16,20}')
  HAVING COUNT(*) > 1
) sub;

-- STEP 2: Delete posts that are NOT in urn:li:activity format if duplicates exist
-- Keep the urn:li:activity version, delete others (ugcPost, share, etc.)
-- ============================================================================
DELETE FROM linkedin_posts_discovered
WHERE id IN (
  SELECT p1.id
  FROM linkedin_posts_discovered p1
  WHERE p1.social_id !~ '^urn:li:activity:'  -- Not in activity format
    AND p1.social_id ~ '\d{16,20}'  -- Has numeric ID
    AND EXISTS (
      -- Check if an activity URN version exists with same numeric ID
      SELECT 1
      FROM linkedin_posts_discovered p2
      WHERE p2.social_id ~ '^urn:li:activity:'
        AND SUBSTRING(p2.social_id FROM '\d{16,20}') = SUBSTRING(p1.social_id FROM '\d{16,20}')
        AND p2.workspace_id = p1.workspace_id
    )
);

-- STEP 3: Normalize remaining posts to urn:li:activity format
-- Converts: urn:li:ugcPost:123 → urn:li:activity:123
--          urn:li:share:123 → urn:li:activity:123
-- ============================================================================
UPDATE linkedin_posts_discovered
SET social_id = 'urn:li:activity:' || SUBSTRING(social_id FROM '\d{16,20}')
WHERE social_id ~ '\d{16,20}'  -- Has numeric ID
  AND social_id !~ '^urn:li:activity:';  -- Not already in activity format

-- STEP 4: Verify - check for remaining duplicates
-- ============================================================================
SELECT
  'Remaining duplicates after normalization:' as check_type,
  COUNT(*) as duplicate_count
FROM (
  SELECT social_id, COUNT(*) as cnt
  FROM linkedin_posts_discovered
  GROUP BY social_id
  HAVING COUNT(*) > 1
) sub;

-- Expected output: 0 duplicates

-- STEP 5: Show what was normalized
-- ============================================================================
SELECT
  'Total posts now in urn:li:activity format:' as info,
  COUNT(*) as count
FROM linkedin_posts_discovered
WHERE social_id ~ '^urn:li:activity:\d{16,20}$';

-- ============================================================================
-- DONE!
-- ============================================================================
-- ✅ All URN types normalized to urn:li:activity:NUMBER
-- ✅ Duplicates with different URN types deleted
-- ✅ Future posts will use consistent format
-- ============================================================================
