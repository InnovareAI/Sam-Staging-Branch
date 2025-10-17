-- Check all workspaces with their search settings

SELECT
  w.id as workspace_id,
  w.name as workspace_name,
  wt.tier as subscription_tier,
  wt.tier_status,
  wt.lead_search_tier,
  wt.monthly_lead_search_quota,
  wt.monthly_lead_searches_used,
  wt.search_quota_reset_date,
  (wt.monthly_lead_search_quota - wt.monthly_lead_searches_used) as quota_remaining,
  -- Check if workspace has any LinkedIn accounts
  (
    SELECT COUNT(*)
    FROM user_unipile_accounts ua
    JOIN workspace_members wm ON ua.user_id = wm.user_id
    WHERE wm.workspace_id = w.id
      AND ua.platform = 'LINKEDIN'
      AND ua.connection_status = 'active'
  ) as linkedin_accounts_connected,
  -- Check if workspace has Sales Navigator
  (
    SELECT COUNT(*)
    FROM user_unipile_accounts ua
    JOIN workspace_members wm ON ua.user_id = wm.user_id
    WHERE wm.workspace_id = w.id
      AND ua.platform = 'LINKEDIN'
      AND ua.linkedin_account_type = 'sales_navigator'
      AND ua.connection_status = 'active'
  ) as sales_nav_accounts,
  w.created_at as workspace_created
FROM workspaces w
LEFT JOIN workspace_tiers wt ON w.id = wt.workspace_id
ORDER BY w.created_at DESC;
