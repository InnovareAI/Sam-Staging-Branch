-- Convert to Single-User Workspaces
-- Simplifies multi-tenant architecture by making workspaces 1:1 with users
-- Date: October 31, 2025
--
-- Context: Only 2 multi-user workspaces exist:
-- 1. InnovareAI (internal) - will keep as shared
-- 2. Sendingcell (paused) - will migrate to single-user

BEGIN;

-- =====================================================================
-- Step 1: Add workspace ownership and type
-- =====================================================================

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS workspace_type TEXT DEFAULT 'personal' CHECK (workspace_type IN ('personal', 'shared'));

-- Create index for owner lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_type ON workspaces(workspace_type);

-- =====================================================================
-- Step 2: Populate owner_id from existing workspace_members
-- =====================================================================

-- For each workspace, set owner_id to the first 'owner' member
-- If no owner exists, use the first 'admin' member
-- If no admin, use any member
UPDATE workspaces w
SET owner_id = (
  SELECT wm.user_id
  FROM workspace_members wm
  WHERE wm.workspace_id = w.id
  ORDER BY
    CASE wm.role
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'member' THEN 3
      ELSE 4
    END
  LIMIT 1
)
WHERE owner_id IS NULL;

-- =====================================================================
-- Step 3: Mark existing multi-user workspaces
-- =====================================================================

-- Mark workspaces with multiple members as 'shared'
UPDATE workspaces w
SET workspace_type = 'shared'
WHERE (
  SELECT COUNT(*)
  FROM workspace_members wm
  WHERE wm.workspace_id = w.id
) > 1;

-- All other workspaces are 'personal'
UPDATE workspaces
SET workspace_type = 'personal'
WHERE workspace_type IS NULL;

COMMENT ON COLUMN workspaces.owner_id IS 'Primary owner of workspace (1:1 for personal, main owner for shared)';
COMMENT ON COLUMN workspaces.workspace_type IS 'personal = single user, shared = team workspace';

-- =====================================================================
-- Step 4: Create view for backward compatibility
-- =====================================================================

-- View that shows workspace membership (including owner)
CREATE OR REPLACE VIEW workspace_membership AS
SELECT
  w.id as workspace_id,
  w.owner_id as user_id,
  'owner' as role,
  w.created_at,
  true as is_owner
FROM workspaces w
WHERE w.workspace_type = 'personal'

UNION ALL

SELECT
  wm.workspace_id,
  wm.user_id,
  wm.role,
  NOW() as created_at,
  (wm.role = 'owner' OR wm.user_id = (SELECT owner_id FROM workspaces WHERE id = wm.workspace_id)) as is_owner
FROM workspace_members wm
WHERE wm.workspace_id IN (
  SELECT id FROM workspaces WHERE workspace_type = 'shared'
);

COMMENT ON VIEW workspace_membership IS 'Unified view of workspace membership (combines owner_id and workspace_members)';

-- Grant access to view
GRANT SELECT ON workspace_membership TO authenticated;

-- =====================================================================
-- Step 5: Simplified RLS policies for personal workspaces
-- =====================================================================

-- Drop existing complex RLS policies and replace with simple owner check
-- This only affects personal workspaces (shared workspaces keep existing policies)

-- Workspaces table
DROP POLICY IF EXISTS "Users access own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace members access workspaces" ON workspaces;

DROP POLICY IF EXISTS "Users access own personal workspaces" ON workspaces;
CREATE POLICY "Users access own personal workspaces" ON workspaces
  FOR ALL TO authenticated
  USING (
    workspace_type = 'personal' AND owner_id = auth.uid()
  )
  WITH CHECK (
    workspace_type = 'personal' AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS "Members access shared workspaces" ON workspaces;
CREATE POLICY "Members access shared workspaces" ON workspaces
  FOR ALL TO authenticated
  USING (
    workspace_type = 'shared' AND id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_type = 'shared' AND id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Service role has full access
DROP POLICY IF EXISTS "Service role full access workspaces" ON workspaces;
CREATE POLICY "Service role full access workspaces" ON workspaces
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- Step 6: Simplify prospect RLS
-- =====================================================================

DROP POLICY IF EXISTS "Users can access prospects in their workspace" ON workspace_prospects;

DROP POLICY IF EXISTS "Users access personal workspace prospects" ON workspace_prospects;
CREATE POLICY "Users access personal workspace prospects" ON workspace_prospects
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'personal' AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'personal' AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members access shared workspace prospects" ON workspace_prospects;
CREATE POLICY "Members access shared workspace prospects" ON workspace_prospects
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'shared' AND id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'shared' AND id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
      )
    )
  );

DROP POLICY IF EXISTS "Service role prospects" ON workspace_prospects;
CREATE POLICY "Service role prospects" ON workspace_prospects
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- Step 7: Simplify campaigns RLS
-- =====================================================================

DROP POLICY IF EXISTS "Authenticated members manage campaigns" ON campaigns;
DROP POLICY IF EXISTS "Service role manages campaigns" ON campaigns;

DROP POLICY IF EXISTS "Users access personal workspace campaigns" ON campaigns;
CREATE POLICY "Users access personal workspace campaigns" ON campaigns
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'personal' AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'personal' AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members access shared workspace campaigns" ON campaigns;
CREATE POLICY "Members access shared workspace campaigns" ON campaigns
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'shared' AND id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'shared' AND id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Service role campaigns" ON campaigns;
CREATE POLICY "Service role campaigns" ON campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- Step 8: Simplify knowledge base RLS
-- =====================================================================

DROP POLICY IF EXISTS "Workspace members access knowledge base" ON knowledge_base;

DROP POLICY IF EXISTS "Users access personal KB" ON knowledge_base;
CREATE POLICY "Users access personal KB" ON knowledge_base
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'personal' AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'personal' AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members access shared KB" ON knowledge_base;
CREATE POLICY "Members access shared KB" ON knowledge_base
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'shared' AND id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id::text FROM workspaces
      WHERE workspace_type = 'shared' AND id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Service role KB" ON knowledge_base;
CREATE POLICY "Service role KB" ON knowledge_base
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================================
-- Step 9: Helper functions
-- =====================================================================

-- Function to check if user owns workspace (simple version)
CREATE OR REPLACE FUNCTION user_owns_workspace(
  p_user_id UUID,
  p_workspace_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_type TEXT;
  v_owner_id UUID;
BEGIN
  SELECT workspace_type, owner_id
  INTO v_workspace_type, v_owner_id
  FROM workspaces
  WHERE id = p_workspace_id;

  -- Personal workspace: must be owner
  IF v_workspace_type = 'personal' THEN
    RETURN v_owner_id = p_user_id;
  END IF;

  -- Shared workspace: check membership
  IF v_workspace_type = 'shared' THEN
    RETURN EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_id = p_workspace_id
        AND user_id = p_user_id
    );
  END IF;

  RETURN false;
END;
$$;

-- Function to get user's workspaces (including personal)
CREATE OR REPLACE FUNCTION get_user_workspaces(p_user_id UUID)
RETURNS TABLE (
  workspace_id TEXT,
  workspace_name TEXT,
  workspace_type TEXT,
  role TEXT,
  is_owner BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- Personal workspaces
  SELECT
    w.id as workspace_id,
    w.name as workspace_name,
    w.workspace_type,
    'owner'::TEXT as role,
    true as is_owner
  FROM workspaces w
  WHERE w.owner_id = p_user_id
    AND w.workspace_type = 'personal'

  UNION ALL

  -- Shared workspaces
  SELECT
    w.id as workspace_id,
    w.name as workspace_name,
    w.workspace_type,
    wm.role,
    (wm.role = 'owner') as is_owner
  FROM workspaces w
  JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id = p_user_id
    AND w.workspace_type = 'shared';
END;
$$;

-- =====================================================================
-- Step 10: Data validation
-- =====================================================================

-- Ensure all workspaces have an owner
DO $$
DECLARE
  v_orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphaned_count
  FROM workspaces
  WHERE owner_id IS NULL;

  IF v_orphaned_count > 0 THEN
    RAISE WARNING 'Found % workspaces without owner_id. Manual intervention required.', v_orphaned_count;
  END IF;
END $$;

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON FUNCTION user_owns_workspace IS 'Check if user owns/has access to workspace (personal or shared)';
COMMENT ON FUNCTION get_user_workspaces IS 'Get all workspaces user has access to (personal + shared)';

-- =====================================================================
-- Migration report
-- =====================================================================

DO $$
DECLARE
  v_total_workspaces INTEGER;
  v_personal_workspaces INTEGER;
  v_shared_workspaces INTEGER;
  v_orphaned_workspaces INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_workspaces FROM workspaces;
  SELECT COUNT(*) INTO v_personal_workspaces FROM workspaces WHERE workspace_type = 'personal';
  SELECT COUNT(*) INTO v_shared_workspaces FROM workspaces WHERE workspace_type = 'shared';
  SELECT COUNT(*) INTO v_orphaned_workspaces FROM workspaces WHERE owner_id IS NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Workspace Migration Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total workspaces: %', v_total_workspaces;
  RAISE NOTICE 'Personal workspaces: %', v_personal_workspaces;
  RAISE NOTICE 'Shared workspaces: %', v_shared_workspaces;
  RAISE NOTICE 'Orphaned workspaces: %', v_orphaned_workspaces;
  RAISE NOTICE '========================================';
END $$;

COMMIT;
