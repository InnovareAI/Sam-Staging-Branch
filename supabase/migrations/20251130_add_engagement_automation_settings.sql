-- Add engagement and automation settings to linkedin_brand_guidelines
-- November 30, 2025

-- Tag Post Authors toggle
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS tag_post_authors BOOLEAN DEFAULT true;

-- Blacklisted Profiles (array of LinkedIn profile URLs/vanities to never engage with)
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS blacklisted_profiles TEXT[];

-- Monitor Comments toggle (track comments to find reply opportunities)
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS monitor_comments BOOLEAN DEFAULT false;

-- Reply to High-Engagement Comments toggle
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS reply_to_high_engagement BOOLEAN DEFAULT false;

-- Auto-Approve Comments settings
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS auto_approve_enabled BOOLEAN DEFAULT false;

ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS auto_approve_start_time TIME DEFAULT '09:00:00';

ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS auto_approve_end_time TIME DEFAULT '17:00:00';

-- Comments
COMMENT ON COLUMN linkedin_brand_guidelines.tag_post_authors IS 'Whether to mention post authors with @username in comments';
COMMENT ON COLUMN linkedin_brand_guidelines.blacklisted_profiles IS 'Array of LinkedIn profiles to never engage with';
COMMENT ON COLUMN linkedin_brand_guidelines.monitor_comments IS 'Track comments on posts to find reply opportunities';
COMMENT ON COLUMN linkedin_brand_guidelines.reply_to_high_engagement IS 'Generate replies to high-engagement comments on posts';
COMMENT ON COLUMN linkedin_brand_guidelines.auto_approve_enabled IS 'Automatically approve and post comments without review';
COMMENT ON COLUMN linkedin_brand_guidelines.auto_approve_start_time IS 'Start time for auto-approval window';
COMMENT ON COLUMN linkedin_brand_guidelines.auto_approve_end_time IS 'End time for auto-approval window';
