-- ============================================================================
-- PURE SQL FIX: "Access denied to workspace" Error
-- ============================================================================
-- Run this in Supabase SQL Editor
-- No verification queries - just the fix
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
