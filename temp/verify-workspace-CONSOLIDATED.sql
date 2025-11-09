-- ============================================================================
-- WORKSPACE VERIFICATION - CONSOLIDATED SINGLE RESULT
-- ============================================================================
-- This returns ONE result set with all verification data
-- ============================================================================

WITH workspace_stats AS (
  SELECT
    w.id,
    w.name,
    w.created_at,
    COUNT(DISTINCT wm.id) AS member_count,
    COUNT(DISTINCT c.id) AS campaign_count,
    COUNT(DISTINCT cp.id) AS prospect_count,
    COUNT(DISTINCT CASE WHEN wm.role = 'owner' AND wm.status = 'active' THEN wm.id END) AS owner_count,
    COUNT(DISTINCT CASE WHEN wm.role = 'admin' AND wm.status = 'active' THEN wm.id END) AS admin_count,
    COUNT(DISTINCT CASE WHEN wm.role = 'member' AND wm.status = 'active' THEN wm.id END) AS member_role_count,
    STRING_AGG(DISTINCT CASE WHEN wm.role = 'owner' THEN u.email END, ', ') AS owner_emails
  FROM workspaces w
  LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
  LEFT JOIN auth.users u ON wm.user_id = u.id
  LEFT JOIN campaigns c ON w.id = c.workspace_id
  LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
  GROUP BY w.id, w.name, w.created_at
),
orphan_checks AS (
  SELECT
    (SELECT COUNT(*) FROM campaigns WHERE workspace_id IS NULL) AS orphaned_campaigns,
    (SELECT COUNT(*) FROM campaign_prospects WHERE campaign_id NOT IN (SELECT id FROM campaigns)) AS orphaned_prospects,
    (SELECT COUNT(*) FROM prospect_approval_sessions WHERE workspace_id IS NULL) AS orphaned_sessions
),
rls_status AS (
  SELECT
    COUNT(*) AS total_critical_tables,
    COUNT(CASE WHEN rowsecurity = true THEN 1 END) AS tables_with_rls
  FROM pg_tables
  WHERE tablename IN (
    'workspaces',
    'workspace_members',
    'campaigns',
    'campaign_prospects',
    'prospect_approval_sessions'
  )
)

SELECT
  '📊 WORKSPACE SUMMARY' AS section,
  (SELECT COUNT(*) FROM workspaces) AS total_workspaces,
  (SELECT COUNT(*) FROM workspace_members WHERE status = 'active') AS total_active_members,
  (SELECT COUNT(*) FROM campaigns) AS total_campaigns,
  (SELECT COUNT(*) FROM campaign_prospects) AS total_prospects,
  (SELECT orphaned_campaigns FROM orphan_checks) AS orphaned_campaigns,
  (SELECT orphaned_prospects FROM orphan_checks) AS orphaned_prospects,
  (SELECT orphaned_sessions FROM orphan_checks) AS orphaned_approval_sessions,
  (SELECT COUNT(*) FROM workspace_stats WHERE owner_count = 0) AS workspaces_without_owners,
  (SELECT tables_with_rls FROM rls_status) AS critical_tables_with_rls,
  (SELECT total_critical_tables FROM rls_status) AS total_critical_tables,
  CASE
    WHEN (SELECT orphaned_campaigns FROM orphan_checks) > 0
      OR (SELECT orphaned_prospects FROM orphan_checks) > 0
      OR (SELECT COUNT(*) FROM workspace_stats WHERE owner_count = 0) > 0
    THEN '❌ ISSUES FOUND'
    ELSE '✅ HEALTHY'
  END AS overall_status;
