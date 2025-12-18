-- Migration: Add 'expired' to status constraints
-- Created: December 18, 2025
-- Purpose: Allow 'expired' status value for posts and comments

-- Drop and recreate the status constraint for linkedin_posts_discovered
ALTER TABLE linkedin_posts_discovered DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE linkedin_posts_discovered ADD CONSTRAINT valid_status
  CHECK (status IN ('discovered', 'processing', 'commented', 'skipped', 'expired'));

-- Drop and recreate the status constraint for linkedin_post_comments
-- Include 'posting' (intermediate state during API call)
ALTER TABLE linkedin_post_comments DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE linkedin_post_comments ADD CONSTRAINT valid_status
  CHECK (status IN ('pending_approval', 'scheduled', 'posting', 'posted', 'rejected', 'failed', 'expired'));
