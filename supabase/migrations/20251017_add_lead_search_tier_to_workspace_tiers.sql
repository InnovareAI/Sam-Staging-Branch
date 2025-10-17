-- Add lead search tier capability to workspace_tiers
-- Migration: 20251017_add_lead_search_tier_to_workspace_tiers.sql
--
-- IMPORTANT: Search access is determined by LinkedIn account type, not subscription tier
-- - Classic/Premium LinkedIn: Limited search → Use BrightData MCP or Google CSE
-- - Sales Navigator: Full search → Use Unipile LinkedIn Search MCP

-- Add column for lead search capabilities
ALTER TABLE workspace_tiers
ADD COLUMN IF NOT EXISTS lead_search_tier TEXT NOT NULL DEFAULT 'external'
CHECK (lead_search_tier IN ('external', 'sales_navigator'));

-- Add column for monthly lead search quota
ALTER TABLE workspace_tiers
ADD COLUMN IF NOT EXISTS monthly_lead_search_quota INTEGER NOT NULL DEFAULT 100;

-- Add column for current monthly usage
ALTER TABLE workspace_tiers
ADD COLUMN IF NOT EXISTS monthly_lead_searches_used INTEGER NOT NULL DEFAULT 0;

-- Add column for last reset date
ALTER TABLE workspace_tiers
ADD COLUMN IF NOT EXISTS search_quota_reset_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Update existing tiers with default search access
-- DEFAULT: All users start with 'external' search (BrightData/Google CSE)
-- Users with Sales Navigator will be updated to 'sales_navigator' when they connect LinkedIn

-- Startup tier: External search (BrightData MCP or Google CSE)
UPDATE workspace_tiers
SET
  lead_search_tier = 'external',
  monthly_lead_search_quota = 1000,
  monthly_lead_searches_used = 0
WHERE tier = 'startup';

-- SME tier: External search (BrightData MCP or Google CSE)
UPDATE workspace_tiers
SET
  lead_search_tier = 'external',
  monthly_lead_search_quota = 5000,
  monthly_lead_searches_used = 0
WHERE tier = 'sme';

-- Enterprise tier: External search (BrightData MCP or Google CSE)
UPDATE workspace_tiers
SET
  lead_search_tier = 'external',
  monthly_lead_search_quota = 10000,
  monthly_lead_searches_used = 0
WHERE tier = 'enterprise';

-- NOTE: When user connects Sales Navigator account, update to:
-- UPDATE workspace_tiers SET lead_search_tier = 'sales_navigator' WHERE workspace_id = ?;

-- Create index for faster tier lookups
CREATE INDEX IF NOT EXISTS idx_workspace_tiers_search_tier ON workspace_tiers(lead_search_tier);

-- Function to check lead search quota
CREATE OR REPLACE FUNCTION check_lead_search_quota(
  p_workspace_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier_record workspace_tiers%ROWTYPE;
  v_quota_available INTEGER;
BEGIN
  -- Get workspace tier info
  SELECT * INTO v_tier_record
  FROM workspace_tiers
  WHERE workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_quota', false,
      'reason', 'no_tier_configured',
      'quota_remaining', 0
    );
  END IF;

  -- Check if quota needs reset (monthly)
  IF v_tier_record.search_quota_reset_date < CURRENT_DATE THEN
    -- Reset quota
    UPDATE workspace_tiers
    SET
      monthly_lead_searches_used = 0,
      search_quota_reset_date = CURRENT_DATE,
      updated_at = NOW()
    WHERE workspace_id = p_workspace_id;

    v_tier_record.monthly_lead_searches_used := 0;
  END IF;

  -- Calculate remaining quota
  v_quota_available := v_tier_record.monthly_lead_search_quota - v_tier_record.monthly_lead_searches_used;

  IF v_quota_available <= 0 THEN
    RETURN jsonb_build_object(
      'has_quota', false,
      'reason', 'quota_exceeded',
      'quota_used', v_tier_record.monthly_lead_searches_used,
      'quota_limit', v_tier_record.monthly_lead_search_quota,
      'quota_remaining', 0,
      'tier', v_tier_record.tier,
      'search_tier', v_tier_record.lead_search_tier
    );
  END IF;

  RETURN jsonb_build_object(
    'has_quota', true,
    'quota_used', v_tier_record.monthly_lead_searches_used,
    'quota_limit', v_tier_record.monthly_lead_search_quota,
    'quota_remaining', v_quota_available,
    'tier', v_tier_record.tier,
    'search_tier', v_tier_record.lead_search_tier,
    'reset_date', v_tier_record.search_quota_reset_date
  );
END;
$$;

-- Function to increment lead search usage
CREATE OR REPLACE FUNCTION increment_lead_search_usage(
  p_workspace_id UUID,
  p_search_count INTEGER DEFAULT 1
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE workspace_tiers
  SET
    monthly_lead_searches_used = monthly_lead_searches_used + p_search_count,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  RETURN FOUND;
END;
$$;

-- Comments
COMMENT ON COLUMN workspace_tiers.lead_search_tier IS 'Lead search capability: external (BrightData/Google CSE for Classic/Premium LinkedIn), sales_navigator (Unipile LinkedIn Search for Sales Nav users)';
COMMENT ON COLUMN workspace_tiers.monthly_lead_search_quota IS 'Monthly quota for lead searches based on subscription tier';
COMMENT ON COLUMN workspace_tiers.monthly_lead_searches_used IS 'Number of lead searches used in current month';
COMMENT ON FUNCTION check_lead_search_quota IS 'Checks if workspace has remaining lead search quota for the current month';
COMMENT ON FUNCTION increment_lead_search_usage IS 'Increments lead search usage counter for workspace';
