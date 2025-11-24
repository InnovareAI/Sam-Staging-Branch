-- Migration: Prevent duplicate LinkedIn posts
-- Created: 2025-11-24
-- Purpose: Add unique constraints to prevent duplicate post storage

-- Drop existing indexes if they exist (in case of re-run)
DROP INDEX IF EXISTS linkedin_posts_discovered_share_url_workspace_idx;
DROP INDEX IF EXISTS linkedin_posts_discovered_social_id_workspace_idx;

-- Add unique index on share_url per workspace
-- This prevents the same LinkedIn post URL from being stored twice
CREATE UNIQUE INDEX linkedin_posts_discovered_share_url_workspace_idx
ON linkedin_posts_discovered (share_url, workspace_id);

-- Add unique index on social_id per workspace
-- This prevents the same LinkedIn post ID from being stored twice
-- (useful if the URL changes but it's the same post)
CREATE UNIQUE INDEX linkedin_posts_discovered_social_id_workspace_idx
ON linkedin_posts_discovered (social_id, workspace_id)
WHERE social_id IS NOT NULL;

-- Add check to ensure at least one identifier exists
ALTER TABLE linkedin_posts_discovered
ADD CONSTRAINT linkedin_posts_discovered_identifier_check
CHECK (
  share_url IS NOT NULL OR social_id IS NOT NULL
);

-- Create index for faster duplicate checks during discovery
CREATE INDEX IF NOT EXISTS linkedin_posts_discovered_monitor_url_idx
ON linkedin_posts_discovered (monitor_id, share_url);

COMMENT ON INDEX linkedin_posts_discovered_share_url_workspace_idx
IS 'Prevents duplicate posts by URL within the same workspace';

COMMENT ON INDEX linkedin_posts_discovered_social_id_workspace_idx
IS 'Prevents duplicate posts by social ID within the same workspace';
