-- Migration: Add database triggers for automatic normalization
-- Date: December 5, 2025
-- Purpose: Automatically normalize company_name, location, title on INSERT/UPDATE

-- ============================================
-- 1. Create normalization functions
-- ============================================

-- Company name normalization function (preserves casing, strips suffixes iteratively)
-- Supports international legal suffixes: US, UK, Germany, France, Netherlands, Sweden, Japan, India, Brazil, Mexico, UAE, etc.
CREATE OR REPLACE FUNCTION normalize_company_display_name(company_name TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
  prev_result TEXT;
BEGIN
  IF company_name IS NULL OR company_name = '' THEN
    RETURN '';
  END IF;

  result := TRIM(company_name);

  -- Strip "The" from start
  result := REGEXP_REPLACE(result, '^The\s+', '', 'i');

  -- Remove parenthetical content
  result := REGEXP_REPLACE(result, '\s*\([^)]*\)', '', 'g');

  -- Loop: strip suffixes until no more changes
  LOOP
    prev_result := result;

    -- 1. Multi-word international suffixes FIRST (order matters!)
    -- Mexico
    result := REGEXP_REPLACE(result, '[,\s]+SAB\s+de\s+CV\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+SA\s+de\s+CV\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+S\s+de\s+RL\s*$', '', 'i');
    -- Poland
    result := REGEXP_REPLACE(result, '[,\s]+Sp\.\s*z\s*o\.o\.\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+z\s*o\.o\.\s*$', '', 'i');
    -- Australia/India/Singapore
    result := REGEXP_REPLACE(result, '[,\s]+Pty\.?\s+Ltd\.?\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+Pvt\.?\s+Ltd\.?\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+Pte\.?\s+Ltd\.?\s*$', '', 'i');
    -- Japan
    result := REGEXP_REPLACE(result, '[,\s]+Godo\s+Kaisha\s*$', '', 'i');
    result := REGEXP_REPLACE(result, '[,\s]+Co\.,?\s*Ltd\.?\s*$', '', 'i');
    -- UAE
    result := REGEXP_REPLACE(result, '[,\s]+FZ-LLC\s*$', '', 'i');

    -- 2. Single-word legal suffixes (international)
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(Incorporated|Corporation|Inc|LLC|LLP|Ltd|Limited|plc|PLC|Co|Corp)\s*\.?$', '', 'i');
    -- Germany/Austria/Switzerland
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(GmbH|KGaA|OHG|AG|KG|SE|eG|e\.V\.)\s*\.?$', '', 'i');
    -- France
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(SAS|SARL|EURL|SCA|SA)\s*\.?$', '', 'i');
    -- Netherlands/Belgium
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(BVBA|B\.V\.?|BV|N\.V\.?|NV|CV)\s*\.?$', '', 'i');
    -- Spain
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(SLU|SL)\s*\.?$', '', 'i');
    -- Italy
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(SpA|Srl|SaS)\s*\.?$', '', 'i');
    -- Scandinavia
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(AB|ASA|AS|A/S|ApS|Oyj|Oy)\s*\.?$', '', 'i');
    -- Japan
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(K\.K\.?|KK|Y\.K\.?)\s*\.?$', '', 'i');
    -- India/Singapore/Australia
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(Pty|Pvt|Pte)\s*\.?$', '', 'i');
    -- Brazil
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(Ltda|EIRELI)\s*\.?$', '', 'i');
    -- Mexico
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(SAPI)\s*\.?$', '', 'i');
    -- UAE
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(PJSC|FZE|FZC)\s*\.?$', '', 'i');
    -- Ireland
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(DAC|CLG)\s*\.?$', '', 'i');

    -- 3. Compound Tech patterns FIRST (before stripping "Solutions" alone)
    result := REGEXP_REPLACE(result, '\s+Tech\s+(Solutions|Services|Group|Systems|Consulting)\s*$', '', 'i');

    -- 4. Then individual business descriptors
    result := REGEXP_REPLACE(result, '\s*[,.]?\s*(International|Technologies|Technology|Consulting|Consultants|Solutions|Holdings|Services|Partners|Partnership|Company|Global|Worldwide|Agency|Enterprises|Ventures|Studios|Studio|Labs|Lab|Digital|Media|Software|Systems)\s*\.?$', '', 'i');

    -- 5. "Group" at end
    result := REGEXP_REPLACE(result, '\s+Group\s*$', '', 'i');

    -- Strip trailing punctuation
    result := REGEXP_REPLACE(result, '[,.\s&]+$', '');

    EXIT WHEN result = prev_result OR LENGTH(result) < 2;
  END LOOP;

  -- Safety: if result is too short, be conservative
  IF LENGTH(result) < 2 THEN
    result := REGEXP_REPLACE(TRIM(company_name), '\s*[,.]?\s*(Inc|LLC|Ltd|Corp|plc|GmbH|AG|BV|AB)\s*\.?$', '', 'i');
    result := TRIM(result);
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Location normalization function
CREATE OR REPLACE FUNCTION normalize_location(loc TEXT)
RETURNS TEXT AS $$
BEGIN
  IF loc IS NULL OR TRIM(loc) = '' THEN
    RETURN NULL;
  END IF;

  RETURN TRIM(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(loc, '\s+Area$', '', 'i'),
          '^Greater\s+', '', 'i'
        ),
        '\s+Metropolitan$', '', 'i'
      ),
      '\s+Metro$', '', 'i'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Title normalization function (basic trim for now)
CREATE OR REPLACE FUNCTION normalize_title(title TEXT)
RETURNS TEXT AS $$
BEGIN
  IF title IS NULL OR TRIM(title) = '' THEN
    RETURN NULL;
  END IF;

  RETURN TRIM(title);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 2. Create trigger function for campaign_prospects
-- ============================================

CREATE OR REPLACE FUNCTION trg_normalize_campaign_prospect()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize company name
  IF NEW.company_name IS DISTINCT FROM OLD.company_name OR TG_OP = 'INSERT' THEN
    NEW.company_name_normalized := normalize_company_display_name(NEW.company_name);
  END IF;

  -- Normalize location
  IF NEW.location IS DISTINCT FROM OLD.location OR TG_OP = 'INSERT' THEN
    NEW.location_normalized := normalize_location(NEW.location);
  END IF;

  -- Normalize title
  IF NEW.title IS DISTINCT FROM OLD.title OR TG_OP = 'INSERT' THEN
    NEW.title_normalized := normalize_title(NEW.title);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Create trigger function for workspace_prospects
-- ============================================

CREATE OR REPLACE FUNCTION trg_normalize_workspace_prospect()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize company name
  IF NEW.company_name IS DISTINCT FROM OLD.company_name OR TG_OP = 'INSERT' THEN
    NEW.company_name_normalized := normalize_company_display_name(NEW.company_name);
  END IF;

  -- Normalize location
  IF NEW.location IS DISTINCT FROM OLD.location OR TG_OP = 'INSERT' THEN
    NEW.location_normalized := normalize_location(NEW.location);
  END IF;

  -- Normalize title (workspace_prospects uses job_title column)
  IF NEW.job_title IS DISTINCT FROM OLD.job_title OR TG_OP = 'INSERT' THEN
    NEW.title_normalized := normalize_title(NEW.job_title);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Create triggers
-- ============================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_campaign_prospect_normalize ON campaign_prospects;
DROP TRIGGER IF EXISTS trg_workspace_prospect_normalize ON workspace_prospects;

-- Create triggers for campaign_prospects
CREATE TRIGGER trg_campaign_prospect_normalize
BEFORE INSERT OR UPDATE ON campaign_prospects
FOR EACH ROW
EXECUTE FUNCTION trg_normalize_campaign_prospect();

-- Create triggers for workspace_prospects
CREATE TRIGGER trg_workspace_prospect_normalize
BEFORE INSERT OR UPDATE ON workspace_prospects
FOR EACH ROW
EXECUTE FUNCTION trg_normalize_workspace_prospect();

-- ============================================
-- 5. Add comments for documentation
-- ============================================

COMMENT ON FUNCTION normalize_company_display_name(TEXT) IS 'Normalizes company names by removing international legal suffixes (Inc, LLC, GmbH, SA, AB, etc.), parenthetical content, and The prefix';
COMMENT ON FUNCTION normalize_location(TEXT) IS 'Normalizes locations by removing Area, Greater, Metropolitan, Metro suffixes';
COMMENT ON FUNCTION normalize_title(TEXT) IS 'Normalizes job titles (basic trim for now)';

COMMENT ON TRIGGER trg_campaign_prospect_normalize ON campaign_prospects IS 'Auto-normalizes company_name, location, title on INSERT/UPDATE';
COMMENT ON TRIGGER trg_workspace_prospect_normalize ON workspace_prospects IS 'Auto-normalizes company_name, location, job_title on INSERT/UPDATE';
