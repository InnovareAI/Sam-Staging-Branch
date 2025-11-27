-- Migration: Add engagement tracking columns to linkedin_post_comments
-- Created: 2025-11-27

-- Add column to store the LinkedIn comment ID from Unipile
ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS linkedin_comment_id TEXT;

-- Add column to store engagement metrics
ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS engagement_metrics JSONB DEFAULT '{}';

-- Add column to track when engagement was last checked
ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS engagement_checked_at TIMESTAMPTZ;

-- Create index for engagement tracking queries
CREATE INDEX IF NOT EXISTS idx_linkedin_post_comments_engagement
ON linkedin_post_comments(status, engagement_checked_at)
WHERE status = 'posted';

-- Comment on columns
COMMENT ON COLUMN linkedin_post_comments.linkedin_comment_id IS 'The Unipile/LinkedIn ID of the posted comment';
COMMENT ON COLUMN linkedin_post_comments.engagement_metrics IS 'JSON object containing likes_count, replies_count, etc.';
COMMENT ON COLUMN linkedin_post_comments.engagement_checked_at IS 'When engagement metrics were last fetched from LinkedIn';
