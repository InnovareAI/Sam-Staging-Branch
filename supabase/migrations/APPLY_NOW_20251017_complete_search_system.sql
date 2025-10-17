-- ================================================================
-- COMPLETE SEARCH SYSTEM MIGRATION
-- Apply this entire file in Supabase SQL Editor
-- Date: 2025-10-17
-- ================================================================

-- ================================================================
-- PART 1: Workspace Search Tiers
-- ================================================================

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
UPDATE workspace_tiers
SET
  lead_search_tier = 'external',
  monthly_lead_search_quota = 1000,
  monthly_lead_searches_used = 0
WHERE tier = 'startup';

UPDATE workspace_tiers
SET
  lead_search_tier = 'external',
  monthly_lead_search_quota = 5000,
  monthly_lead_searches_used = 0
WHERE tier = 'sme';

UPDATE workspace_tiers
SET
  lead_search_tier = 'external',
  monthly_lead_search_quota = 10000,
  monthly_lead_searches_used = 0
WHERE tier = 'enterprise';

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

-- ================================================================
-- PART 2: LinkedIn Account Type Tracking
-- ================================================================

-- Add column for LinkedIn account type
ALTER TABLE user_unipile_accounts
ADD COLUMN IF NOT EXISTS linkedin_account_type TEXT
CHECK (linkedin_account_type IN ('classic', 'premium', 'premium_career', 'premium_business', 'sales_navigator', 'recruiter_lite', 'unknown'));

-- Add column for account features detected
ALTER TABLE user_unipile_accounts
ADD COLUMN IF NOT EXISTS account_features JSONB DEFAULT '{}';

-- Set default to 'unknown' for existing LinkedIn accounts
UPDATE user_unipile_accounts
SET linkedin_account_type = 'unknown'
WHERE platform = 'LINKEDIN' AND linkedin_account_type IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_unipile_accounts_linkedin_type
ON user_unipile_accounts(linkedin_account_type)
WHERE platform = 'LINKEDIN';

-- Function to detect and update LinkedIn account type from Unipile data
CREATE OR REPLACE FUNCTION detect_linkedin_account_type(
  p_account_id UUID,
  p_unipile_account_data JSONB
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_type TEXT := 'unknown';
  v_features JSONB;
BEGIN
  -- Extract features from Unipile account data
  v_features := COALESCE(p_unipile_account_data->'features', '{}'::jsonb);

  -- Detect account type based on features
  IF v_features ? 'sales_navigator' OR
     v_features ? 'advanced_search' OR
     v_features ? 'lead_builder' THEN
    v_account_type := 'sales_navigator';
  ELSIF v_features ? 'recruiter_lite' THEN
    v_account_type := 'recruiter_lite';
  ELSIF v_features ? 'premium_business' THEN
    v_account_type := 'premium_business';
  ELSIF v_features ? 'premium_career' OR v_features ? 'premium' THEN
    v_account_type := 'premium_career';
  ELSIF v_features ? 'basic' OR jsonb_array_length(v_features) = 0 THEN
    v_account_type := 'classic';
  END IF;

  -- Update the account record
  UPDATE user_unipile_accounts
  SET
    linkedin_account_type = v_account_type,
    account_features = v_features,
    updated_at = NOW()
  WHERE id = p_account_id;

  RETURN v_account_type;
END;
$$;

-- Function to automatically update workspace search tier based on LinkedIn accounts
CREATE OR REPLACE FUNCTION update_workspace_search_tier_from_linkedin(
  p_workspace_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_sales_nav BOOLEAN := FALSE;
  v_new_search_tier TEXT;
BEGIN
  -- Check if any member has Sales Navigator
  SELECT EXISTS(
    SELECT 1
    FROM user_unipile_accounts ua
    JOIN workspace_members wm ON ua.user_id = wm.user_id
    WHERE wm.workspace_id = p_workspace_id
      AND ua.platform = 'LINKEDIN'
      AND ua.linkedin_account_type = 'sales_navigator'
      AND ua.connection_status = 'active'
  ) INTO v_has_sales_nav;

  -- Determine search tier
  IF v_has_sales_nav THEN
    v_new_search_tier := 'sales_navigator';
  ELSE
    v_new_search_tier := 'external';
  END IF;

  -- Update workspace tier
  UPDATE workspace_tiers
  SET
    lead_search_tier = v_new_search_tier,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id;

  RETURN v_new_search_tier;
END;
$$;

-- Trigger to update workspace search tier when LinkedIn account changes
CREATE OR REPLACE FUNCTION trigger_update_workspace_search_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  -- Get all workspaces this user is a member of
  FOR v_workspace_id IN
    SELECT DISTINCT workspace_id
    FROM workspace_members
    WHERE user_id = NEW.user_id
  LOOP
    PERFORM update_workspace_search_tier_from_linkedin(v_workspace_id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_workspace_search_tier ON user_unipile_accounts;

CREATE TRIGGER trg_update_workspace_search_tier
AFTER INSERT OR UPDATE OF linkedin_account_type, connection_status
ON user_unipile_accounts
FOR EACH ROW
WHEN (NEW.platform = 'LINKEDIN')
EXECUTE FUNCTION trigger_update_workspace_search_tier();

-- ================================================================
-- PART 3: Comments
-- ================================================================

COMMENT ON COLUMN workspace_tiers.lead_search_tier IS 'Lead search capability: external (BrightData/Google CSE for Classic/Premium LinkedIn), sales_navigator (Unipile LinkedIn Search for Sales Nav users)';
COMMENT ON COLUMN workspace_tiers.monthly_lead_search_quota IS 'Monthly quota for lead searches based on subscription tier';
COMMENT ON COLUMN workspace_tiers.monthly_lead_searches_used IS 'Number of lead searches used in current month';
COMMENT ON FUNCTION check_lead_search_quota IS 'Checks if workspace has remaining lead search quota for the current month';
COMMENT ON FUNCTION increment_lead_search_usage IS 'Increments lead search usage counter for workspace';

COMMENT ON COLUMN user_unipile_accounts.linkedin_account_type IS 'Type of LinkedIn account: classic (free), premium (Career/Business), sales_navigator (Sales Nav), or unknown';
COMMENT ON COLUMN user_unipile_accounts.account_features IS 'Features detected from Unipile account data (used to determine account type)';
COMMENT ON FUNCTION detect_linkedin_account_type IS 'Detects LinkedIn account type from Unipile account data and updates user_unipile_accounts';
COMMENT ON FUNCTION update_workspace_search_tier_from_linkedin IS 'Updates workspace search tier based on LinkedIn account types of members';

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================

-- Run verification queries below to confirm success:
-- SELECT 'Migration completed successfully!' as status;
