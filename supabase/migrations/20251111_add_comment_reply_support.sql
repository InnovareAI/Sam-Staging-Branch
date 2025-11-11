-- =====================================================
-- LinkedIn Commenting Agent - Add Reply to Comments Support
-- Created: November 11, 2025
-- =====================================================

-- Add reply support to linkedin_posts_discovered
-- This allows tracking individual comments on posts, not just the post itself
ALTER TABLE linkedin_posts_discovered
ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES linkedin_posts_discovered(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_comment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS comment_author_linkedin_id TEXT,
ADD COLUMN IF NOT EXISTS comment_author_name TEXT,
ADD COLUMN IF NOT EXISTS comment_text TEXT,
ADD COLUMN IF NOT EXISTS comment_posted_at TIMESTAMPTZ;

-- Create index for finding comments on a specific post
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_parent_post ON linkedin_posts_discovered(parent_post_id) WHERE parent_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_is_comment ON linkedin_posts_discovered(is_comment) WHERE is_comment = true;

-- Add comment context to linkedin_comment_queue
ALTER TABLE linkedin_comment_queue
ADD COLUMN IF NOT EXISTS reply_to_comment_id TEXT,  -- LinkedIn comment ID we're replying to
ADD COLUMN IF NOT EXISTS reply_to_author_name TEXT,  -- Who we're replying to
ADD COLUMN IF NOT EXISTS is_comment_reply BOOLEAN DEFAULT false;  -- true if replying to a comment, false if replying to post

-- Create index for tracking comment replies
CREATE INDEX IF NOT EXISTS idx_linkedin_comment_queue_reply ON linkedin_comment_queue(is_comment_reply) WHERE is_comment_reply = true;

COMMENT ON COLUMN linkedin_posts_discovered.parent_post_id IS 'If this is a comment, reference to the parent post';
COMMENT ON COLUMN linkedin_posts_discovered.is_comment IS 'true if this is a comment on a post, false if this is the original post';
COMMENT ON COLUMN linkedin_comment_queue.reply_to_comment_id IS 'LinkedIn comment ID to reply to (for nested comment threads)';
COMMENT ON COLUMN linkedin_comment_queue.is_comment_reply IS 'true if replying to a comment, false if commenting on post';

-- Update the linkedin_post_monitors table to support monitoring comments
ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS monitor_comments BOOLEAN DEFAULT false,  -- Should we also discover comments on posts?
ADD COLUMN IF NOT EXISTS reply_to_comments BOOLEAN DEFAULT false,  -- Should we reply to comments?
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';  -- User's timezone for scheduling

COMMENT ON COLUMN linkedin_post_monitors.monitor_comments IS 'If true, discover and store comments on posts (not just posts themselves)';
COMMENT ON COLUMN linkedin_post_monitors.reply_to_comments IS 'If true, generate replies to high-engagement comments';
COMMENT ON COLUMN linkedin_post_monitors.timezone IS 'User timezone for scheduling comments (e.g., America/New_York, Europe/London)';

-- Add engagement tracking for comment replies
ALTER TABLE linkedin_comments_posted
ADD COLUMN IF NOT EXISTS is_comment_reply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS replied_to_comment_id TEXT,  -- Which comment did we reply to
ADD COLUMN IF NOT EXISTS replied_to_author_name TEXT;

COMMENT ON COLUMN linkedin_comments_posted.is_comment_reply IS 'true if this was a reply to another comment';
COMMENT ON COLUMN linkedin_comments_posted.replied_to_comment_id IS 'LinkedIn ID of the comment we replied to';

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Reply-to-comments support added!';
  RAISE NOTICE '📊 Updated tables: linkedin_posts_discovered, linkedin_comment_queue, linkedin_post_monitors, linkedin_comments_posted';
  RAISE NOTICE '🎯 New capabilities:';
  RAISE NOTICE '   - Track individual comments on posts';
  RAISE NOTICE '   - Reply to specific comments (threaded conversations)';
  RAISE NOTICE '   - Monitor comments for reply opportunities';
  RAISE NOTICE '   - Track which comments we replied to';
END $$;

-- Show updated schema
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('linkedin_posts_discovered', 'linkedin_comment_queue', 'linkedin_post_monitors', 'linkedin_comments_posted')
  AND column_name IN ('parent_post_id', 'is_comment', 'reply_to_comment_id', 'is_comment_reply', 'monitor_comments', 'reply_to_comments', 'replied_to_comment_id')
ORDER BY table_name, ordinal_position;
