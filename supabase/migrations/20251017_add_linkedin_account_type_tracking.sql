-- Add LinkedIn account type tracking to user_unipile_accounts
-- Migration: 20251017_add_linkedin_account_type_tracking.sql
--
-- Track which type of LinkedIn account users have:
-- - classic: Free LinkedIn (very limited search)
-- - premium: Premium Career/Premium Business (better search but still limited)
-- - sales_navigator: Sales Navigator (full LinkedIn search via Unipile)

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
  v_workspace_ids UUID[];
BEGIN
  -- Get all workspaces this user is a member of
  SELECT ARRAY_AGG(DISTINCT workspace_id)
  INTO v_workspace_ids
  FROM workspace_members
  WHERE user_id = NEW.user_id;

  -- Update search tier for each workspace
  IF v_workspace_ids IS NOT NULL THEN
    FOREACH v_workspace_ids IN ARRAY v_workspace_ids LOOP
      PERFORM update_workspace_search_tier_from_linkedin(v_workspace_ids);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on user_unipile_accounts
DROP TRIGGER IF EXISTS trg_update_workspace_search_tier ON user_unipile_accounts;
CREATE TRIGGER trg_update_workspace_search_tier
AFTER INSERT OR UPDATE OF linkedin_account_type, connection_status
ON user_unipile_accounts
FOR EACH ROW
WHEN (NEW.platform = 'LINKEDIN')
EXECUTE FUNCTION trigger_update_workspace_search_tier();

-- Comments
COMMENT ON COLUMN user_unipile_accounts.linkedin_account_type IS 'Type of LinkedIn account: classic (free), premium (Career/Business), sales_navigator (Sales Nav), or unknown';
COMMENT ON COLUMN user_unipile_accounts.account_features IS 'Features detected from Unipile account data (used to determine account type)';
COMMENT ON FUNCTION detect_linkedin_account_type IS 'Detects LinkedIn account type from Unipile account data and updates user_unipile_accounts';
COMMENT ON FUNCTION update_workspace_search_tier_from_linkedin IS 'Updates workspace search tier based on LinkedIn account types of members';
COMMENT ON TRIGGER trg_update_workspace_search_tier ON user_unipile_accounts IS 'Automatically updates workspace search tier when LinkedIn account type changes';
