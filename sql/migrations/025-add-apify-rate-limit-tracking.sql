-- Migration: Add Apify API call rate limit tracking
-- Date: December 4, 2025
-- Purpose: Track actual Apify API calls per workspace per day (25 max)

-- Add columns to linkedin_brand_guidelines for tracking Apify calls
ALTER TABLE linkedin_brand_guidelines
  ADD COLUMN IF NOT EXISTS apify_calls_today INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS apify_calls_reset_date DATE DEFAULT CURRENT_DATE;

-- Function to increment Apify call counter and check if within limit
CREATE OR REPLACE FUNCTION increment_apify_call_counter(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_reset_date DATE;
  v_max_calls INTEGER := 25;
BEGIN
  -- Get or create the brand guidelines row
  INSERT INTO linkedin_brand_guidelines (workspace_id, apify_calls_today, apify_calls_reset_date)
  VALUES (p_workspace_id, 0, CURRENT_DATE)
  ON CONFLICT (workspace_id) DO NOTHING;

  -- Get current count and reset date
  SELECT apify_calls_today, apify_calls_reset_date
  INTO v_current_count, v_reset_date
  FROM linkedin_brand_guidelines
  WHERE workspace_id = p_workspace_id
  FOR UPDATE;  -- Lock the row

  -- Reset counter if it's a new day
  IF v_reset_date IS NULL OR v_reset_date < CURRENT_DATE THEN
    v_current_count := 0;
    v_reset_date := CURRENT_DATE;
  END IF;

  -- Check if at limit
  IF v_current_count >= v_max_calls THEN
    RETURN FALSE;  -- Limit reached, do not allow API call
  END IF;

  -- Increment counter
  UPDATE linkedin_brand_guidelines
  SET apify_calls_today = v_current_count + 1,
      apify_calls_reset_date = CURRENT_DATE
  WHERE workspace_id = p_workspace_id;

  RETURN TRUE;  -- OK to make API call
END;
$$;

-- Function to check remaining Apify calls for a workspace
CREATE OR REPLACE FUNCTION get_remaining_apify_calls(p_workspace_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_reset_date DATE;
  v_max_calls INTEGER := 25;
BEGIN
  SELECT apify_calls_today, apify_calls_reset_date
  INTO v_current_count, v_reset_date
  FROM linkedin_brand_guidelines
  WHERE workspace_id = p_workspace_id;

  -- No record = full allowance
  IF v_current_count IS NULL THEN
    RETURN v_max_calls;
  END IF;

  -- Reset if new day
  IF v_reset_date IS NULL OR v_reset_date < CURRENT_DATE THEN
    RETURN v_max_calls;
  END IF;

  RETURN GREATEST(0, v_max_calls - v_current_count);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_apify_call_counter(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_apify_call_counter(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_remaining_apify_calls(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_remaining_apify_calls(UUID) TO service_role;

-- Comment
COMMENT ON COLUMN linkedin_brand_guidelines.apify_calls_today IS 'Number of Apify API calls made today for this workspace (max 25)';
COMMENT ON COLUMN linkedin_brand_guidelines.apify_calls_reset_date IS 'Date when apify_calls_today was last reset';
