-- Migration: Add normalized company name columns for deduplication and analytics
-- Date: December 5, 2025
-- Purpose: Store both raw and normalized company names for better matching

-- ============================================
-- 1. Add normalized columns to campaign_prospects
-- ============================================

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS company_name_normalized TEXT;

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS title_normalized TEXT;

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS location_normalized TEXT;

-- ============================================
-- 2. Add normalized columns to workspace_prospects
-- ============================================

ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS company_name_normalized TEXT;

ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS title_normalized TEXT;

ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS location_normalized TEXT;

-- ============================================
-- 3. Create indexes for faster lookups
-- ============================================

CREATE INDEX IF NOT EXISTS idx_campaign_prospects_company_normalized
ON campaign_prospects(company_name_normalized);

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_company_normalized
ON workspace_prospects(company_name_normalized);

-- ============================================
-- 4. Populate normalized company names (batch update)
-- ============================================

-- campaign_prospects: Normalize company names
UPDATE campaign_prospects
SET company_name_normalized =
  LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(company_name, '\s*\([^)]*\)', '', 'g'),  -- Remove parenthetical content
          '\s*(Inc\.?|Corp\.?|LLC|Ltd\.?|GmbH|S\.A\.|Co\.?|Company|Group|Holdings|Solutions|Technologies|International|Services|Consulting|Partners|Agency|Global|Limited|PLC)$', '', 'i'  -- Remove legal suffixes
        ),
        '^The\s+', '', 'i'  -- Remove "The" prefix
      ),
      '[,.]$', ''  -- Remove trailing punctuation
    )
  ))
WHERE company_name IS NOT NULL
  AND company_name != ''
  AND (company_name_normalized IS NULL OR company_name_normalized = '');

-- workspace_prospects: Normalize company names
UPDATE workspace_prospects
SET company_name_normalized =
  LOWER(TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(company_name, '\s*\([^)]*\)', '', 'g'),  -- Remove parenthetical content
          '\s*(Inc\.?|Corp\.?|LLC|Ltd\.?|GmbH|S\.A\.|Co\.?|Company|Group|Holdings|Solutions|Technologies|International|Services|Consulting|Partners|Agency|Global|Limited|PLC)$', '', 'i'  -- Remove legal suffixes
        ),
        '^The\s+', '', 'i'  -- Remove "The" prefix
      ),
      '[,.]$', ''  -- Remove trailing punctuation
    )
  ))
WHERE company_name IS NOT NULL
  AND company_name != ''
  AND (company_name_normalized IS NULL OR company_name_normalized = '');

-- ============================================
-- 5. Normalize locations (remove Area, Greater, etc.)
-- ============================================

UPDATE campaign_prospects
SET location_normalized =
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(location, '\s+Area$', '', 'i'),
        '^Greater\s+', '', 'i'
      ),
      '\s+Metropolitan$', '', 'i'
    )
  )
WHERE location IS NOT NULL
  AND location != ''
  AND (location_normalized IS NULL OR location_normalized = '');

UPDATE workspace_prospects
SET location_normalized =
  TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(location, '\s+Area$', '', 'i'),
        '^Greater\s+', '', 'i'
      ),
      '\s+Metropolitan$', '', 'i'
    )
  )
WHERE location IS NOT NULL
  AND location != ''
  AND (location_normalized IS NULL OR location_normalized = '');

-- ============================================
-- 6. Normalize job titles (basic title casing)
-- ============================================

UPDATE campaign_prospects
SET title_normalized = TRIM(title)
WHERE title IS NOT NULL
  AND title != ''
  AND (title_normalized IS NULL OR title_normalized = '');

UPDATE workspace_prospects
SET title_normalized = TRIM(job_title)
WHERE job_title IS NOT NULL
  AND job_title != ''
  AND (title_normalized IS NULL OR title_normalized = '');

-- ============================================
-- 7. Add comments for documentation
-- ============================================

COMMENT ON COLUMN campaign_prospects.company_name_normalized IS 'Lowercase normalized company name without legal suffixes (Inc, LLC, etc.) for deduplication';
COMMENT ON COLUMN campaign_prospects.title_normalized IS 'Normalized job title with standardized abbreviations';
COMMENT ON COLUMN campaign_prospects.location_normalized IS 'Normalized location without Area/Greater/Metropolitan suffixes';

COMMENT ON COLUMN workspace_prospects.company_name_normalized IS 'Lowercase normalized company name without legal suffixes (Inc, LLC, etc.) for deduplication';
COMMENT ON COLUMN workspace_prospects.title_normalized IS 'Normalized job title with standardized abbreviations';
COMMENT ON COLUMN workspace_prospects.location_normalized IS 'Normalized location without Area/Greater/Metropolitan suffixes';
