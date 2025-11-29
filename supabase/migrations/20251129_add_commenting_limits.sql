-- Add commenting limits and cadence settings to linkedin_brand_guidelines
-- November 29, 2025

-- Add daily comment limit (hard limit, max 30)
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS daily_comment_limit INTEGER DEFAULT 30;

-- Add commenting cadence settings (min/max days between comments on same profile)
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS min_days_between_profile_comments INTEGER DEFAULT 1;

ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS max_days_between_profile_comments INTEGER DEFAULT 7;

-- Add constraint to ensure daily_comment_limit is between 1 and 30
ALTER TABLE linkedin_brand_guidelines
DROP CONSTRAINT IF EXISTS check_daily_comment_limit;

ALTER TABLE linkedin_brand_guidelines
ADD CONSTRAINT check_daily_comment_limit
CHECK (daily_comment_limit >= 1 AND daily_comment_limit <= 30);

-- Add constraint to ensure min_days <= max_days
ALTER TABLE linkedin_brand_guidelines
DROP CONSTRAINT IF EXISTS check_comment_cadence;

ALTER TABLE linkedin_brand_guidelines
ADD CONSTRAINT check_comment_cadence
CHECK (min_days_between_profile_comments <= max_days_between_profile_comments);

-- Comment on new columns
COMMENT ON COLUMN linkedin_brand_guidelines.daily_comment_limit IS 'Maximum comments per day (hard limit: 1-30)';
COMMENT ON COLUMN linkedin_brand_guidelines.min_days_between_profile_comments IS 'Minimum days to wait before commenting on the same profile again';
COMMENT ON COLUMN linkedin_brand_guidelines.max_days_between_profile_comments IS 'Maximum days to wait before commenting on the same profile again';
