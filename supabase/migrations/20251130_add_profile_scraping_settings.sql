-- Add profile scraping settings to linkedin_brand_guidelines
-- November 30, 2025

-- Days between scraping each profile (1-30 days)
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS profile_scrape_interval_days INTEGER DEFAULT 1;

-- Maximum profile scrapes per day (1-20)
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS max_profile_scrapes_per_day INTEGER DEFAULT 20;

-- Add constraint for profile_scrape_interval_days (1-30)
ALTER TABLE linkedin_brand_guidelines
DROP CONSTRAINT IF EXISTS check_profile_scrape_interval;

ALTER TABLE linkedin_brand_guidelines
ADD CONSTRAINT check_profile_scrape_interval
CHECK (profile_scrape_interval_days >= 1 AND profile_scrape_interval_days <= 30);

-- Add constraint for max_profile_scrapes_per_day (1-20)
ALTER TABLE linkedin_brand_guidelines
DROP CONSTRAINT IF EXISTS check_max_profile_scrapes;

ALTER TABLE linkedin_brand_guidelines
ADD CONSTRAINT check_max_profile_scrapes
CHECK (max_profile_scrapes_per_day >= 1 AND max_profile_scrapes_per_day <= 20);

-- Track when each monitor was last scraped
ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP;

-- Track daily scrape count (reset each day)
ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS scrapes_today INTEGER DEFAULT 0;

ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS scrape_count_reset_date DATE DEFAULT CURRENT_DATE;

-- Comments
COMMENT ON COLUMN linkedin_brand_guidelines.profile_scrape_interval_days IS 'Days to wait before scraping same profile again (1-30)';
COMMENT ON COLUMN linkedin_brand_guidelines.max_profile_scrapes_per_day IS 'Maximum number of profile scrapes per day (1-20)';
COMMENT ON COLUMN linkedin_post_monitors.last_scraped_at IS 'Timestamp of last successful scrape';
COMMENT ON COLUMN linkedin_post_monitors.scrapes_today IS 'Number of scrapes performed today';
COMMENT ON COLUMN linkedin_post_monitors.scrape_count_reset_date IS 'Date when scrapes_today was last reset';
