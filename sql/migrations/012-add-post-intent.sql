-- Migration: Add post_intent column to track post types
-- Created: 2025-12-07
-- Purpose: Enable question post detection for better AI comment generation

-- Add post_intent column to linkedin_posts_discovered table
ALTER TABLE linkedin_posts_discovered
ADD COLUMN IF NOT EXISTS post_intent VARCHAR(50) DEFAULT 'thought_leadership';

-- Add comment for documentation
COMMENT ON COLUMN linkedin_posts_discovered.post_intent IS 'Detected intent of the post: question, thought_leadership, announcement, etc.';

-- Create index for filtering by intent (improve query performance)
CREATE INDEX IF NOT EXISTS idx_posts_intent
ON linkedin_posts_discovered(post_intent);

-- Possible values for post_intent:
-- - 'question': Posts asking readers to answer questions or make choices
-- - 'thought_leadership': Standard industry insights/opinions
-- - 'announcement': Product launches, company news, etc.
