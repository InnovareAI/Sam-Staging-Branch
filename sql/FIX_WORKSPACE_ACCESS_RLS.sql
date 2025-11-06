-- ============================================================================
-- FIX: "Access denied to workspace" Error
-- ============================================================================
-- Date: November 7, 2025
-- Issue: RLS policies blocking legitimate workspace member access
-- Solution: Apply proven RLS policies from Nov 6 fix
-- ============================================================================

-- STEP 1: Fix workspace_members table RLS policy
-- This allows users to read their own memberships and see other members in their workspaces
-- ============================================================================

DROP POLICY IF EXISTS "Users read their memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can view their workspace memberships" ON workspace_members;
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;

CREATE POLICY "Users read their memberships"
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

-- ============================================================================
-- STEP 2: Fix campaigns table RLS policy
-- This allows workspace members to manage campaigns in their workspaces
-- ============================================================================

DROP POLICY IF EXISTS "Workspace owners full campaign access" ON campaigns;
DROP POLICY IF EXISTS "Workspace members can manage campaigns" ON campaigns;

CREATE POLICY "Workspace owners full campaign access"
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

-- ============================================================================
-- STEP 3: Fix campaign_prospects table RLS policy
-- This allows workspace members to manage prospects in their campaigns
-- ============================================================================

DROP POLICY IF EXISTS "Workspace owners full prospect access" ON campaign_prospects;
DROP POLICY IF EXISTS "Workspace members can manage campaign prospects" ON campaign_prospects;

CREATE POLICY "Workspace owners full prospect access"
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

-- ============================================================================
-- STEP 4: Ensure service role has full access (bypass RLS)
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access" ON workspace_members;
CREATE POLICY "Service role full access"
ON workspace_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full campaign access" ON campaigns;
CREATE POLICY "Service role full campaign access"
ON campaigns
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full prospect access" ON campaign_prospects;
CREATE POLICY "Service role full prospect access"
ON campaign_prospects
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these after applying the fix to verify it worked
-- ============================================================================

-- 1. Check if you can see your workspace memberships
SELECT
  workspace_id,
  role,
  status,
  joined_at
FROM workspace_members
WHERE user_id = auth.uid();

-- 2. Check if you can see campaigns in your workspaces
SELECT
  c.id,
  c.name,
  c.status,
  c.workspace_id
FROM campaigns c
WHERE c.workspace_id IN (
  SELECT workspace_id
  FROM workspace_members
  WHERE user_id = auth.uid() AND status = 'active'
)
ORDER BY c.created_at DESC
LIMIT 5;

-- 3. Verify RLS policies are active
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('workspace_members', 'campaigns', 'campaign_prospects')
ORDER BY tablename, policyname;

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
-- Query 1: Should return your workspace memberships (at least 1 row)
-- Query 2: Should return campaigns you have access to
-- Query 3: Should show the policies we just created
-- ============================================================================
