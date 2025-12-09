-- Migration: 028-prevent-duplicate-comments.sql
-- Date: December 9, 2025
-- Purpose: CRITICAL - Prevent duplicate comments on same LinkedIn post
--
-- Background: System posted 3-4 duplicate comments on same post due to race condition
-- between concurrent cron runs. This constraint makes duplicates physically impossible.

-- Step 1: Add 'posting' and 'skipped' to valid status values
-- First drop the existing constraint, then recreate with new values
ALTER TABLE linkedin_post_comments
DROP CONSTRAINT IF EXISTS linkedin_post_comments_status_check;

ALTER TABLE linkedin_post_comments
ADD CONSTRAINT linkedin_post_comments_status_check
CHECK (status IN ('pending_approval', 'scheduled', 'posting', 'posted', 'rejected', 'failed', 'skipped'));

-- Step 2: Check for existing duplicates and remove them
-- Keep only the oldest comment per post_id
DELETE FROM linkedin_post_comments
WHERE id NOT IN (
  SELECT MIN(id)
  FROM linkedin_post_comments
  GROUP BY post_id
);

-- Step 3: Add unique constraint - one comment per post
ALTER TABLE linkedin_post_comments
ADD CONSTRAINT unique_comment_per_post UNIQUE (post_id);

-- Step 4: Add index on social_id for faster duplicate checks
CREATE INDEX IF NOT EXISTS idx_posts_discovered_social_id
ON linkedin_posts_discovered(social_id);

-- Step 5: Add index on workspace_id + status for faster comment queries
CREATE INDEX IF NOT EXISTS idx_comments_workspace_status
ON linkedin_post_comments(workspace_id, status);

-- Verification
SELECT
  'Constraint added' as status,
  COUNT(*) as total_comments
FROM linkedin_post_comments;
