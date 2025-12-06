-- Migration: Add country filtering for LinkedIn post discovery
-- Date: 2025-12-06
-- Description: Adds target_countries to brand guidelines (workspace-level setting)
--              and author_country to discovered posts for filtering.

-- 1. Add target_countries column to linkedin_brand_guidelines
-- This is a workspace-level setting where users can specify which countries to filter posts from
ALTER TABLE linkedin_brand_guidelines
  ADD COLUMN IF NOT EXISTS target_countries TEXT[] DEFAULT NULL;

COMMENT ON COLUMN linkedin_brand_guidelines.target_countries IS
  'Array of countries to filter post authors by. NULL or empty means no filtering (all countries). Example: ["United States", "Canada", "United Kingdom"]';

-- 2. Add author_country to discovered posts
ALTER TABLE linkedin_posts_discovered
  ADD COLUMN IF NOT EXISTS author_country TEXT DEFAULT NULL;

COMMENT ON COLUMN linkedin_posts_discovered.author_country IS
  'Extracted country from author LinkedIn location. Used for country-based filtering.';

-- 3. Create index for faster country-based queries
CREATE INDEX IF NOT EXISTS idx_posts_discovered_author_country
  ON linkedin_posts_discovered (author_country)
  WHERE author_country IS NOT NULL;
