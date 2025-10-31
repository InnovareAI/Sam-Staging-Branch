-- LinkedIn URL Validation and Normalization
-- Adds format validation and normalization for LinkedIn profile URLs
-- Date: October 31, 2025

BEGIN;

-- =====================================================================
-- LinkedIn URL normalization function
-- =====================================================================

CREATE OR REPLACE FUNCTION normalize_linkedin_url(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN NULL;
  END IF;

  -- Convert to lowercase
  v_normalized := lower(trim(url));

  -- Remove trailing slashes
  v_normalized := regexp_replace(v_normalized, '/+$', '');

  -- Remove query parameters
  v_normalized := regexp_replace(v_normalized, '\?.*$', '');

  -- Ensure https
  IF v_normalized !~ '^https?://' THEN
    v_normalized := 'https://' || v_normalized;
  END IF;

  -- Ensure www. is present or absent consistently (remove it)
  v_normalized := regexp_replace(v_normalized, 'https?://(www\.)?linkedin\.com', 'https://linkedin.com');

  -- Remove locale parameters (e.g., /in-us/ -> /in/)
  v_normalized := regexp_replace(v_normalized, '/in-[a-z]{2}/', '/in/');

  RETURN v_normalized;
END;
$$;

-- =====================================================================
-- LinkedIn URL validation function
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_linkedin_url(url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN false;
  END IF;

  -- Check if URL matches LinkedIn profile pattern
  -- Acceptable formats:
  -- https://linkedin.com/in/john-smith-123
  -- https://www.linkedin.com/in/jane-doe
  -- https://linkedin.com/pub/name/1/2/3
  RETURN url ~ '^https?://(www\.)?linkedin\.com/(in|pub)/[a-zA-Z0-9_-]+(/.*)?$';
END;
$$;

-- =====================================================================
-- Add validation constraints to workspace_prospects
-- =====================================================================

-- Add check constraint for LinkedIn URL format
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'linkedin_url_format'
      AND conrelid = 'workspace_prospects'::regclass
  ) THEN
    ALTER TABLE workspace_prospects DROP CONSTRAINT linkedin_url_format;
  END IF;

  -- Add new constraint
  ALTER TABLE workspace_prospects
  ADD CONSTRAINT linkedin_url_format
  CHECK (
    linkedin_profile_url IS NULL OR
    validate_linkedin_url(linkedin_profile_url)
  );
END $$;

-- =====================================================================
-- Email validation function
-- =====================================================================

CREATE OR REPLACE FUNCTION validate_email(email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF email IS NULL OR email = '' THEN
    RETURN false;
  END IF;

  -- RFC 5322 simplified email validation
  RETURN email ~ '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$';
END;
$$;

-- Add email validation constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_address_format'
      AND conrelid = 'workspace_prospects'::regclass
  ) THEN
    ALTER TABLE workspace_prospects DROP CONSTRAINT email_address_format;
  END IF;

  ALTER TABLE workspace_prospects
  ADD CONSTRAINT email_address_format
  CHECK (
    email_address IS NULL OR
    validate_email(email_address)
  );
END $$;

-- =====================================================================
-- Phone number validation and normalization
-- =====================================================================

CREATE OR REPLACE FUNCTION normalize_phone_number(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF phone IS NULL OR phone = '' THEN
    RETURN NULL;
  END IF;

  -- Remove all non-numeric characters except +
  RETURN regexp_replace(phone, '[^0-9+]', '', 'g');
END;
$$;

CREATE OR REPLACE FUNCTION validate_phone_number(phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF phone IS NULL OR phone = '' THEN
    RETURN false;
  END IF;

  -- Accept international format (+1234567890) or national format (1234567890)
  -- Minimum 10 digits, maximum 15 digits
  RETURN phone ~ '^\+?[0-9]{10,15}$';
END;
$$;

-- =====================================================================
-- Trigger to auto-normalize LinkedIn URLs on insert/update
-- =====================================================================

CREATE OR REPLACE FUNCTION normalize_prospect_data()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalize LinkedIn URL
  IF NEW.linkedin_profile_url IS NOT NULL THEN
    NEW.linkedin_profile_url := normalize_linkedin_url(NEW.linkedin_profile_url);
  END IF;

  -- Normalize email (lowercase, trim)
  IF NEW.email_address IS NOT NULL THEN
    NEW.email_address := lower(trim(NEW.email_address));
  END IF;

  -- Normalize phone number
  IF NEW.phone_number IS NOT NULL THEN
    NEW.phone_number := normalize_phone_number(NEW.phone_number);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_normalize_prospect_data ON workspace_prospects;

-- Create trigger
CREATE TRIGGER trigger_normalize_prospect_data
  BEFORE INSERT OR UPDATE ON workspace_prospects
  FOR EACH ROW
  EXECUTE FUNCTION normalize_prospect_data();

-- =====================================================================
-- Apply normalization to existing data
-- =====================================================================

-- Function to normalize existing prospect data
CREATE OR REPLACE FUNCTION normalize_existing_prospects(
  p_batch_size INTEGER DEFAULT 1000
)
RETURNS TABLE (
  normalized_count INTEGER,
  error_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_normalized INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Normalize LinkedIn URLs
  UPDATE workspace_prospects
  SET linkedin_profile_url = normalize_linkedin_url(linkedin_profile_url)
  WHERE linkedin_profile_url IS NOT NULL
    AND linkedin_profile_url != normalize_linkedin_url(linkedin_profile_url)
  LIMIT p_batch_size;

  GET DIAGNOSTICS v_normalized = ROW_COUNT;

  -- Normalize emails
  UPDATE workspace_prospects
  SET email_address = lower(trim(email_address))
  WHERE email_address IS NOT NULL
    AND email_address != lower(trim(email_address))
  LIMIT p_batch_size;

  -- Normalize phone numbers
  UPDATE workspace_prospects
  SET phone_number = normalize_phone_number(phone_number)
  WHERE phone_number IS NOT NULL
    AND phone_number != normalize_phone_number(phone_number)
  LIMIT p_batch_size;

  RETURN QUERY SELECT v_normalized, v_errors;
END;
$$;

-- =====================================================================
-- Data quality scoring
-- =====================================================================

CREATE OR REPLACE FUNCTION calculate_prospect_data_quality_score(p_prospect_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_score INTEGER := 0;
  v_prospect workspace_prospects%ROWTYPE;
BEGIN
  SELECT * INTO v_prospect
  FROM workspace_prospects
  WHERE id = p_prospect_id;

  -- Required fields (10 points each)
  IF v_prospect.first_name IS NOT NULL AND v_prospect.first_name != '' THEN
    v_score := v_score + 10;
  END IF;

  IF v_prospect.last_name IS NOT NULL AND v_prospect.last_name != '' THEN
    v_score := v_score + 10;
  END IF;

  IF v_prospect.company_name IS NOT NULL AND v_prospect.company_name != '' THEN
    v_score := v_score + 10;
  END IF;

  -- LinkedIn URL (15 points if valid)
  IF validate_linkedin_url(v_prospect.linkedin_profile_url) THEN
    v_score := v_score + 15;
  END IF;

  -- Email (15 points if valid)
  IF validate_email(v_prospect.email_address) THEN
    v_score := v_score + 15;
  END IF;

  -- Phone (10 points if valid)
  IF validate_phone_number(v_prospect.phone_number) THEN
    v_score := v_score + 10;
  END IF;

  -- Job title (10 points)
  IF v_prospect.job_title IS NOT NULL AND v_prospect.job_title != '' THEN
    v_score := v_score + 10;
  END IF;

  -- Industry (10 points)
  IF v_prospect.industry IS NOT NULL AND v_prospect.industry != '' THEN
    v_score := v_score + 10;
  END IF;

  -- Location (10 points)
  IF v_prospect.location IS NOT NULL AND v_prospect.location != '' THEN
    v_score := v_score + 10;
  END IF;

  RETURN v_score; -- Max score: 100
END;
$$;

-- Add data quality score column
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS data_quality_score INTEGER DEFAULT 0;

-- Create index on quality score
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_quality_score
ON workspace_prospects(data_quality_score)
WHERE data_quality_score > 0;

-- =====================================================================
-- Function to update quality scores
-- =====================================================================

CREATE OR REPLACE FUNCTION update_prospect_quality_scores(
  p_workspace_id UUID DEFAULT NULL,
  p_batch_size INTEGER DEFAULT 1000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  UPDATE workspace_prospects
  SET data_quality_score = calculate_prospect_data_quality_score(id)
  WHERE (p_workspace_id IS NULL OR workspace_id = p_workspace_id::text)
    AND (data_quality_score = 0 OR data_quality_score IS NULL)
  LIMIT p_batch_size;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON FUNCTION normalize_linkedin_url IS 'Normalizes LinkedIn profile URL (lowercase, remove query params, consistent format)';
COMMENT ON FUNCTION validate_linkedin_url IS 'Validates LinkedIn profile URL format';
COMMENT ON FUNCTION validate_email IS 'Validates email address format (RFC 5322 simplified)';
COMMENT ON FUNCTION normalize_phone_number IS 'Normalizes phone number (digits only, optional + prefix)';
COMMENT ON FUNCTION validate_phone_number IS 'Validates phone number format (10-15 digits)';
COMMENT ON FUNCTION calculate_prospect_data_quality_score IS 'Calculates data quality score (0-100) based on field completeness and validity';
COMMENT ON FUNCTION normalize_existing_prospects IS 'Normalizes existing prospect data in batches';

-- =====================================================================
-- Apply to linkedin_contacts table as well
-- =====================================================================

-- Add validation to linkedin_contacts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'linkedin_contacts'
  ) THEN
    -- Add constraint
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'linkedin_contacts_url_format'
    ) THEN
      ALTER TABLE linkedin_contacts
      ADD CONSTRAINT linkedin_contacts_url_format
      CHECK (
        linkedin_profile_url IS NULL OR
        validate_linkedin_url(linkedin_profile_url)
      );
    END IF;

    -- Add normalization trigger
    CREATE OR REPLACE FUNCTION normalize_linkedin_contact_data()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      IF NEW.linkedin_profile_url IS NOT NULL THEN
        NEW.linkedin_profile_url := normalize_linkedin_url(NEW.linkedin_profile_url);
      END IF;
      RETURN NEW;
    END;
    $func$;

    DROP TRIGGER IF EXISTS trigger_normalize_linkedin_contact ON linkedin_contacts;

    CREATE TRIGGER trigger_normalize_linkedin_contact
      BEFORE INSERT OR UPDATE ON linkedin_contacts
      FOR EACH ROW
      EXECUTE FUNCTION normalize_linkedin_contact_data();
  END IF;
END $$;

COMMIT;
