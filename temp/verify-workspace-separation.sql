-- ============================================================================
-- WORKSPACE SEPARATION & MEMBERSHIP VERIFICATION SCRIPT
-- ============================================================================
-- Purpose: Verify workspace isolation and member access controls
-- Date: November 9, 2025
-- ============================================================================

-- ============================================================================
-- PART 1: WORKSPACE OVERVIEW
-- ============================================================================

SELECT '=== WORKSPACE OVERVIEW ===' AS section;

-- Count of total workspaces
SELECT
  'Total Workspaces' AS metric,
  COUNT(*) AS count
FROM workspaces;

-- Workspaces with details
SELECT
  id,
  name,
  created_at,
  (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = workspaces.id) AS member_count,
  (SELECT COUNT(*) FROM campaigns WHERE workspace_id = workspaces.id) AS campaign_count,
  (SELECT COUNT(*) FROM campaign_prospects cp
   JOIN campaigns c ON cp.campaign_id = c.id
   WHERE c.workspace_id = workspaces.id) AS prospect_count
FROM workspaces
ORDER BY created_at DESC;

-- ============================================================================
-- PART 2: WORKSPACE MEMBERS VERIFICATION
-- ============================================================================

SELECT '=== WORKSPACE MEMBERS ===' AS section;

-- All workspace memberships
SELECT
  w.name AS workspace_name,
  w.id AS workspace_id,
  u.email AS user_email,
  wm.user_id,
  wm.role,
  wm.status,
  wm.created_at
FROM workspace_members wm
JOIN workspaces w ON wm.workspace_id = w.id
JOIN auth.users u ON wm.user_id = u.id
ORDER BY w.name, wm.created_at;

-- Member count per workspace
SELECT
  w.name AS workspace_name,
  w.id AS workspace_id,
  COUNT(wm.id) AS total_members,
  COUNT(CASE WHEN wm.status = 'active' THEN 1 END) AS active_members,
  COUNT(CASE WHEN wm.role = 'owner' THEN 1 END) AS owners,
  COUNT(CASE WHEN wm.role = 'admin' THEN 1 END) AS admins,
  COUNT(CASE WHEN wm.role = 'member' THEN 1 END) AS members
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
GROUP BY w.id, w.name
ORDER BY w.name;

-- ============================================================================
-- PART 3: USER MULTI-WORKSPACE ACCESS
-- ============================================================================

SELECT '=== USERS WITH MULTIPLE WORKSPACE ACCESS ===' AS section;

-- Users who have access to multiple workspaces
SELECT
  u.email,
  u.id AS user_id,
  COUNT(DISTINCT wm.workspace_id) AS workspace_count,
  STRING_AGG(DISTINCT w.name, ', ') AS workspace_names
FROM auth.users u
JOIN workspace_members wm ON u.id = wm.user_id
JOIN workspaces w ON wm.workspace_id = w.id
WHERE wm.status = 'active'
GROUP BY u.id, u.email
HAVING COUNT(DISTINCT wm.workspace_id) > 1
ORDER BY workspace_count DESC;

-- ============================================================================
-- PART 4: WORKSPACE DATA ISOLATION CHECK
-- ============================================================================

SELECT '=== DATA ISOLATION VERIFICATION ===' AS section;

-- Check for campaigns with correct workspace assignment
SELECT
  w.name AS workspace_name,
  c.id AS campaign_id,
  c.name AS campaign_name,
  c.workspace_id,
  COUNT(cp.id) AS prospect_count
FROM workspaces w
JOIN campaigns c ON w.id = c.workspace_id
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
GROUP BY w.id, w.name, c.id, c.name, c.workspace_id
ORDER BY w.name, c.name;

-- Check for orphaned campaigns (no workspace)
SELECT
  'Orphaned Campaigns' AS issue,
  COUNT(*) AS count
FROM campaigns
WHERE workspace_id IS NULL;

-- Check for orphaned campaign_prospects (no campaign)
SELECT
  'Orphaned Campaign Prospects' AS issue,
  COUNT(*) AS count
FROM campaign_prospects
WHERE campaign_id NOT IN (SELECT id FROM campaigns);

-- ============================================================================
-- PART 5: WORKSPACE MEMBER ROLE VERIFICATION
-- ============================================================================

SELECT '=== WORKSPACE ROLE DISTRIBUTION ===' AS section;

-- Workspaces without owners (CRITICAL ISSUE)
SELECT
  w.name AS workspace_name,
  w.id AS workspace_id,
  COUNT(CASE WHEN wm.role = 'owner' THEN 1 END) AS owner_count
FROM workspaces w
LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.status = 'active'
GROUP BY w.id, w.name
HAVING COUNT(CASE WHEN wm.role = 'owner' THEN 1 END) = 0
ORDER BY w.name;

-- Workspaces with multiple owners
SELECT
  w.name AS workspace_name,
  w.id AS workspace_id,
  COUNT(CASE WHEN wm.role = 'owner' THEN 1 END) AS owner_count,
  STRING_AGG(u.email, ', ') AS owner_emails
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.status = 'active'
JOIN auth.users u ON wm.user_id = u.id
WHERE wm.role = 'owner'
GROUP BY w.id, w.name
HAVING COUNT(CASE WHEN wm.role = 'owner' THEN 1 END) > 1
ORDER BY w.name;

-- ============================================================================
-- PART 6: RLS POLICY VERIFICATION
-- ============================================================================

SELECT '=== RLS POLICIES CHECK ===' AS section;

-- Check if RLS is enabled on critical tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE tablename IN (
  'workspaces',
  'workspace_members',
  'campaigns',
  'campaign_prospects',
  'workspace_prospects',
  'prospect_approval_sessions',
  'prospect_approval_data'
)
ORDER BY tablename;

-- List all RLS policies on workspace-related tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN (
  'workspaces',
  'workspace_members',
  'campaigns',
  'campaign_prospects',
  'workspace_prospects'
)
ORDER BY tablename, policyname;

-- ============================================================================
-- PART 7: CROSS-WORKSPACE DATA LEAK CHECK
-- ============================================================================

SELECT '=== CROSS-WORKSPACE DATA LEAK CHECK ===' AS section;

-- Check if any campaign_prospects reference campaigns from different workspaces
-- (This should return 0 rows)
SELECT
  cp.id AS prospect_id,
  c1.workspace_id AS campaign_workspace,
  c2.workspace_id AS prospect_campaign_workspace
FROM campaign_prospects cp
JOIN campaigns c1 ON cp.campaign_id = c1.id
LEFT JOIN campaigns c2 ON cp.campaign_id = c2.id
WHERE c1.workspace_id != c2.workspace_id;

-- ============================================================================
-- PART 8: SPECIFIC USER WORKSPACE ACCESS
-- ============================================================================

SELECT '=== USER WORKSPACE ACCESS DETAILS ===' AS section;

-- For each user, show which workspaces they can access
SELECT
  u.email,
  u.id AS user_id,
  w.name AS workspace_name,
  w.id AS workspace_id,
  wm.role,
  wm.status,
  wm.created_at AS joined_at
FROM auth.users u
JOIN workspace_members wm ON u.id = wm.user_id
JOIN workspaces w ON wm.workspace_id = w.id
ORDER BY u.email, w.name;

-- ============================================================================
-- PART 9: CAMPAIGN CREATOR DATA ISOLATION
-- ============================================================================

SELECT '=== CAMPAIGN CREATOR (PROSPECT APPROVAL) ISOLATION ===' AS section;

-- Prospect approval sessions by workspace
SELECT
  w.name AS workspace_name,
  w.id AS workspace_id,
  COUNT(pas.id) AS approval_sessions,
  COUNT(DISTINCT pas.created_by) AS unique_creators,
  SUM((
    SELECT COUNT(*)
    FROM prospect_approval_data pad
    WHERE pad.session_id = pas.id
  )) AS total_prospects_in_approval
FROM workspaces w
LEFT JOIN prospect_approval_sessions pas ON w.id = pas.workspace_id
GROUP BY w.id, w.name
ORDER BY w.name;

-- Check for orphaned approval sessions (no workspace)
SELECT
  'Orphaned Approval Sessions' AS issue,
  COUNT(*) AS count
FROM prospect_approval_sessions
WHERE workspace_id IS NULL;

-- ============================================================================
-- PART 10: WORKSPACE SECURITY RECOMMENDATIONS
-- ============================================================================

SELECT '=== SECURITY RECOMMENDATIONS ===' AS section;

-- Check for inactive members that should be cleaned up
SELECT
  'Inactive Members (cleanup recommended)' AS recommendation,
  COUNT(*) AS count
FROM workspace_members
WHERE status = 'inactive'
  AND updated_at < NOW() - INTERVAL '90 days';

-- Check for workspaces with no active members
SELECT
  'Workspaces with No Active Members' AS recommendation,
  COUNT(*) AS count
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM workspace_members wm
  WHERE wm.workspace_id = w.id
    AND wm.status = 'active'
);

-- ============================================================================
-- END OF VERIFICATION SCRIPT
-- ============================================================================

SELECT '=== VERIFICATION COMPLETE ===' AS section;
SELECT NOW() AS verification_timestamp;
