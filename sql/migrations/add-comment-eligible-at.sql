-- Migration: Add comment_eligible_at column for engagement waiting period
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new

-- Add comment_eligible_at column (random delay before we can comment)
ALTER TABLE linkedin_posts_discovered
ADD COLUMN IF NOT EXISTS comment_eligible_at TIMESTAMPTZ;

-- Comment
COMMENT ON COLUMN linkedin_posts_discovered.comment_eligible_at IS 'Earliest time we can generate a comment (random 1-4 hour delay after discovery)';

-- Create index for efficient filtering by eligible posts
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_eligible
ON linkedin_posts_discovered(status, comment_eligible_at)
WHERE status = 'discovered' AND comment_eligible_at IS NOT NULL;
