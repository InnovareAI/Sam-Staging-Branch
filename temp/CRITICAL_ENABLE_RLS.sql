-- ============================================================================
-- CRITICAL SECURITY FIX: Enable RLS on All Workspace Tables
-- ============================================================================
-- Date: November 9, 2025
-- Issue: 4 critical tables have NO Row Level Security enabled
-- Risk: Users can access data from other workspaces
-- Action: Enable RLS and create proper policies
-- ============================================================================

-- STEP 1: ENABLE RLS ON ALL CRITICAL TABLES
-- ============================================================================

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_approval_sessions ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT
  tablename,
  rowsecurity AS rls_enabled,
  CASE
    WHEN rowsecurity = true THEN '✅ Protected'
    ELSE '❌ Still vulnerable'
  END AS status
FROM pg_tables
WHERE tablename IN (
  'workspaces',
  'workspace_members',
  'campaigns',
  'campaign_prospects',
  'prospect_approval_sessions'
)
ORDER BY rowsecurity DESC, tablename;

-- ============================================================================
-- STEP 2: CREATE RLS POLICIES
-- ============================================================================

-- ============================================================================
-- WORKSPACE_MEMBERS POLICIES
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Service role full access on workspace_members" ON workspace_members;

-- Policy 1: Users can view their own memberships and members of their workspaces
CREATE POLICY "Users can view their workspace memberships"
ON workspace_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 2: Users can update their own membership status
CREATE POLICY "Users can update their own membership"
ON workspace_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy 3: Service role has full access
CREATE POLICY "Service role full access on workspace_members"
ON workspace_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- CAMPAIGNS POLICIES
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view campaigns in their workspaces" ON campaigns;
DROP POLICY IF EXISTS "Users can manage campaigns in their workspaces" ON campaigns;
DROP POLICY IF EXISTS "Service role full access on campaigns" ON campaigns;

-- Policy 1: Users can view campaigns in their workspaces
CREATE POLICY "Users can view campaigns in their workspaces"
ON campaigns
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 2: Users can create/update campaigns in their workspaces
CREATE POLICY "Users can manage campaigns in their workspaces"
ON campaigns
FOR ALL
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 3: Service role has full access
CREATE POLICY "Service role full access on campaigns"
ON campaigns
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- CAMPAIGN_PROSPECTS POLICIES
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view prospects in their campaigns" ON campaign_prospects;
DROP POLICY IF EXISTS "Users can manage prospects in their campaigns" ON campaign_prospects;
DROP POLICY IF EXISTS "Service role full access on campaign_prospects" ON campaign_prospects;

-- Policy 1: Users can view prospects in campaigns they have access to
CREATE POLICY "Users can view prospects in their campaigns"
ON campaign_prospects
FOR SELECT
TO authenticated
USING (
  campaign_id IN (
    SELECT c.id
    FROM campaigns c
    INNER JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
  )
);

-- Policy 2: Users can manage prospects in campaigns they have access to
CREATE POLICY "Users can manage prospects in their campaigns"
ON campaign_prospects
FOR ALL
TO authenticated
USING (
  campaign_id IN (
    SELECT c.id
    FROM campaigns c
    INNER JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
  )
)
WITH CHECK (
  campaign_id IN (
    SELECT c.id
    FROM campaigns c
    INNER JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
  )
);

-- Policy 3: Service role has full access
CREATE POLICY "Service role full access on campaign_prospects"
ON campaign_prospects
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- PROSPECT_APPROVAL_SESSIONS POLICIES
-- ============================================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view approval sessions in their workspaces" ON prospect_approval_sessions;
DROP POLICY IF EXISTS "Users can manage approval sessions in their workspaces" ON prospect_approval_sessions;
DROP POLICY IF EXISTS "Service role full access on prospect_approval_sessions" ON prospect_approval_sessions;

-- Policy 1: Users can view approval sessions in their workspaces
CREATE POLICY "Users can view approval sessions in their workspaces"
ON prospect_approval_sessions
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 2: Users can manage approval sessions in their workspaces
CREATE POLICY "Users can manage approval sessions in their workspaces"
ON prospect_approval_sessions
FOR ALL
TO authenticated
USING (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

-- Policy 3: Service role has full access
CREATE POLICY "Service role full access on prospect_approval_sessions"
ON prospect_approval_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- STEP 3: VERIFY ALL POLICIES ARE CREATED
-- ============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS operation
FROM pg_policies
WHERE tablename IN (
  'workspace_members',
  'campaigns',
  'campaign_prospects',
  'prospect_approval_sessions'
)
ORDER BY tablename, policyname;

-- ============================================================================
-- STEP 4: FINAL VERIFICATION
-- ============================================================================

SELECT
  '✅ RLS SECURITY FIX COMPLETE' AS status,
  COUNT(CASE WHEN rowsecurity = true THEN 1 END) AS tables_protected,
  COUNT(*) AS total_tables,
  CASE
    WHEN COUNT(CASE WHEN rowsecurity = true THEN 1 END) = COUNT(*)
    THEN '✅ ALL TABLES PROTECTED'
    ELSE '❌ SOME TABLES STILL VULNERABLE'
  END AS security_status
FROM pg_tables
WHERE tablename IN (
  'workspaces',
  'workspace_members',
  'campaigns',
  'campaign_prospects',
  'prospect_approval_sessions'
);

-- ============================================================================
-- END OF CRITICAL FIX
-- ============================================================================
