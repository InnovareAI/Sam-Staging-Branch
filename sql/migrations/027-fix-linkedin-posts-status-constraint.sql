-- Migration: Fix linkedin_posts_discovered status constraint
-- Date: December 9, 2025
-- Purpose: Add missing status values to the valid_status constraint
--
-- The constraint was originally: ('discovered', 'processing', 'commented', 'skipped')
-- But the auto-generate-comments cron job uses:
--   - 'processing_comment' (when claiming posts for processing)
--   - 'comment_pending' (when comment is generated, awaiting approval/posting)
--
-- RUN THIS MANUALLY IN SUPABASE SQL EDITOR

-- Drop the old constraint
ALTER TABLE linkedin_posts_discovered DROP CONSTRAINT IF EXISTS valid_status;

-- Add new constraint with expanded status values
ALTER TABLE linkedin_posts_discovered
ADD CONSTRAINT valid_status
CHECK (status IN (
  'discovered',           -- Post found, not yet processed
  'processing',           -- Legacy status for backward compatibility
  'processing_comment',   -- Claimed for AI comment generation
  'comment_pending',      -- Comment generated, awaiting approval/posting
  'commented',            -- Comment posted to LinkedIn
  'skipped'               -- Skipped (blacklist, no content, 10-day rule, etc.)
));

-- Verify the constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'valid_status';
