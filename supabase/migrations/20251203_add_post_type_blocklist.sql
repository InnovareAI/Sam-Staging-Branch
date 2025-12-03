-- Add post type blocklist columns to linkedin_brand_guidelines
-- These settings control which types of posts are filtered out during discovery

ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS block_job_posts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS block_event_posts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS block_promotional_posts BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS block_repost_only BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS block_generic_motivation BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS block_self_promotion BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_blocked_keywords TEXT[] DEFAULT NULL;

-- Add comments
COMMENT ON COLUMN linkedin_brand_guidelines.block_job_posts IS 'Filter out hiring announcements and job listings';
COMMENT ON COLUMN linkedin_brand_guidelines.block_event_posts IS 'Filter out webinar invites and event promotions';
COMMENT ON COLUMN linkedin_brand_guidelines.block_promotional_posts IS 'Filter out product launches and sales pitches';
COMMENT ON COLUMN linkedin_brand_guidelines.block_repost_only IS 'Filter out reposts without original commentary';
COMMENT ON COLUMN linkedin_brand_guidelines.block_generic_motivation IS 'Filter out generic motivational posts';
COMMENT ON COLUMN linkedin_brand_guidelines.block_self_promotion IS 'Filter out self-promotional achievement posts';
COMMENT ON COLUMN linkedin_brand_guidelines.custom_blocked_keywords IS 'Custom keywords/phrases to block';
