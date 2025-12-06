-- Migration: Add columns for comment reply tracking
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new

-- Add columns to track when we're replying to a comment vs direct post comment
ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS is_reply_to_comment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reply_to_comment_id TEXT,
ADD COLUMN IF NOT EXISTS reply_to_author_name TEXT;

-- Comments
COMMENT ON COLUMN linkedin_post_comments.is_reply_to_comment IS 'True if this is a reply to another comment, false if direct post comment';
COMMENT ON COLUMN linkedin_post_comments.reply_to_comment_id IS 'LinkedIn comment ID we are replying to (if is_reply_to_comment = true)';
COMMENT ON COLUMN linkedin_post_comments.reply_to_author_name IS 'Name of the author whose comment we are replying to';

-- Create index for analytics
CREATE INDEX IF NOT EXISTS idx_comments_is_reply
ON linkedin_post_comments(workspace_id, is_reply_to_comment)
WHERE is_reply_to_comment = true;
