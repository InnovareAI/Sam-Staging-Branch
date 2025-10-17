-- ================================================================
-- VERIFICATION QUERIES
-- Run these after applying the migration to verify success
-- ================================================================

-- 1. Check workspace_tiers columns exist
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'workspace_tiers'
  AND column_name IN (
    'lead_search_tier',
    'monthly_lead_search_quota',
    'monthly_lead_searches_used',
    'search_quota_reset_date'
  )
ORDER BY column_name;

-- Expected: 4 rows showing the new columns

-- 2. Check user_unipile_accounts columns exist
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_unipile_accounts'
  AND column_name IN (
    'linkedin_account_type',
    'account_features'
  )
ORDER BY column_name;

-- Expected: 2 rows

-- 3. Check functions were created
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'check_lead_search_quota',
    'increment_lead_search_usage',
    'detect_linkedin_account_type',
    'update_workspace_search_tier_from_linkedin',
    'trigger_update_workspace_search_tier'
  )
ORDER BY routine_name;

-- Expected: 5 rows (4 functions + 1 trigger function)

-- 4. Check trigger exists
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_update_workspace_search_tier';

-- Expected: 1 row showing the trigger

-- 5. Check workspace tiers have been updated with quotas
SELECT
  tier,
  lead_search_tier,
  monthly_lead_search_quota,
  monthly_lead_searches_used,
  COUNT(*) as workspace_count
FROM workspace_tiers
GROUP BY tier, lead_search_tier, monthly_lead_search_quota, monthly_lead_searches_used
ORDER BY tier;

-- Expected:
-- startup | external | 1000 | 0 | (count)
-- sme | external | 5000 | 0 | (count)
-- enterprise | external | 10000 | 0 | (count)

-- 6. Test quota check function with a real workspace
-- Replace 'YOUR-WORKSPACE-ID' with an actual workspace UUID from your database
SELECT check_lead_search_quota('YOUR-WORKSPACE-ID'::uuid);

-- Expected: JSON object with has_quota: true, quota info, etc.

-- 7. Check LinkedIn accounts (if any exist)
SELECT
  user_id,
  platform,
  linkedin_account_type,
  connection_status,
  account_name
FROM user_unipile_accounts
WHERE platform = 'LINKEDIN'
ORDER BY created_at DESC
LIMIT 10;

-- Expected: Shows LinkedIn accounts with linkedin_account_type populated

-- 8. Test increment function (won't actually change anything without workspace_id)
-- SELECT increment_lead_search_usage('YOUR-WORKSPACE-ID'::uuid, 1);

-- ================================================================
-- IF ALL QUERIES RETURN EXPECTED RESULTS, MIGRATION WAS SUCCESSFUL!
-- ================================================================
