-- Part 1: Add columns to tables
-- Run this in Supabase SQL Editor

ALTER TABLE linkedin_posts_discovered
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN linkedin_posts_discovered.expires_at IS 'When this post expires if not commented on (6 AM UTC next business day)';
COMMENT ON COLUMN linkedin_posts_discovered.expired_at IS 'When this post was marked as expired';
COMMENT ON COLUMN linkedin_post_comments.expires_at IS 'When this comment expires if not approved (6 AM UTC next business day)';
COMMENT ON COLUMN linkedin_post_comments.expired_at IS 'When this comment was marked as expired';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_posts_expires_at
  ON linkedin_posts_discovered(workspace_id, expires_at)
  WHERE status = 'discovered' AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_expires_at
  ON linkedin_post_comments(workspace_id, expires_at)
  WHERE status IN ('pending_approval', 'scheduled') AND expires_at IS NOT NULL;
