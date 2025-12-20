-- Add expires_at to linkedin_posts_discovered for automated cleanup
-- Created: December 21, 2025

ALTER TABLE linkedin_posts_discovered 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_expires_at ON linkedin_posts_discovered(expires_at) 
WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN linkedin_posts_discovered.expires_at IS 'Timestamp when the post discovery record should be automatically removed if not processed';
