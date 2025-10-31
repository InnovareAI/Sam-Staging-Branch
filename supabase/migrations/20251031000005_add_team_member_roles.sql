-- Add Team Member Roles to Personal Workspaces
-- Allows non-account holders to collaborate as viewers/admins
-- Date: October 31, 2025
--
-- Context: Personal workspaces have ONE owner with connected accounts
--          Team members can view/collaborate WITHOUT connecting accounts

BEGIN;

-- =====================================================================
-- Update workspace_members table
-- =====================================================================

-- Add constraint: Only shared workspaces or viewer/admin roles allowed
ALTER TABLE workspace_members
ADD COLUMN IF NOT EXISTS can_connect_accounts BOOLEAN DEFAULT false;

COMMENT ON COLUMN workspace_members.can_connect_accounts IS 'Whether member can connect LinkedIn/email accounts (only owner in personal workspaces)';

-- =====================================================================
-- Update role definitions
-- =====================================================================

-- Redefine role check to include 'viewer'
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_members_role_check'
      AND conrelid = 'workspace_members'::regclass
  ) THEN
    ALTER TABLE workspace_members DROP CONSTRAINT workspace_members_role_check;
  END IF;

  -- Add new constraint
  ALTER TABLE workspace_members
  ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'admin', 'member', 'viewer'));
END $$;

COMMENT ON COLUMN workspace_members.role IS 'owner = full access + accounts, admin = manage without accounts, member = collaborate, viewer = read-only';

-- =====================================================================
-- Set can_connect_accounts based on existing roles
-- =====================================================================

-- Only owners can connect accounts
UPDATE workspace_members
SET can_connect_accounts = (role = 'owner');

-- =====================================================================
-- Add workspace member limits
-- =====================================================================

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS max_team_members INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS team_member_count INTEGER DEFAULT 0;

COMMENT ON COLUMN workspaces.max_team_members IS 'Maximum team members allowed (for billing tiers)';
COMMENT ON COLUMN workspaces.team_member_count IS 'Current number of team members (cached for performance)';

-- Initialize team_member_count
UPDATE workspaces w
SET team_member_count = (
  SELECT COUNT(*)
  FROM workspace_members wm
  WHERE wm.workspace_id = w.id
    AND wm.role != 'owner'
) - 1; -- Subtract 1 because owner doesn't count as team member

-- =====================================================================
-- Function to check if user can be added as team member
-- =====================================================================

CREATE OR REPLACE FUNCTION can_add_team_member(
  p_workspace_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_count INTEGER;
  v_max_count INTEGER;
BEGIN
  SELECT team_member_count, max_team_members
  INTO v_current_count, v_max_count
  FROM workspaces
  WHERE id = p_workspace_id;

  RETURN v_current_count < v_max_count;
END;
$$;

-- =====================================================================
-- Function to add team member to personal workspace
-- =====================================================================

CREATE OR REPLACE FUNCTION add_team_member_to_workspace(
  p_workspace_id TEXT,
  p_user_id UUID,
  p_role TEXT DEFAULT 'viewer',
  p_added_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace workspaces%ROWTYPE;
  v_member_id UUID;
BEGIN
  -- Get workspace
  SELECT * INTO v_workspace
  FROM workspaces
  WHERE id = p_workspace_id;

  IF v_workspace.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Workspace not found');
  END IF;

  -- Check if at team member limit
  IF v_workspace.team_member_count >= v_workspace.max_team_members THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Team member limit reached',
      'limit', v_workspace.max_team_members
    );
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'member', 'viewer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role. Use: admin, member, or viewer');
  END IF;

  -- Check if user already a member
  IF EXISTS (
    SELECT 1 FROM workspace_members
    WHERE id = p_workspace_id::uuid
      AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already a member');
  END IF;

  -- Add team member
  INSERT INTO workspace_members (
    workspace_id,
    user_id,
    role,
    can_connect_accounts
  )
  VALUES (
    p_workspace_id,
    p_user_id,
    p_role,
    false -- Team members cannot connect accounts
  )
  RETURNING id INTO v_member_id;

  -- Increment team member count
  UPDATE workspaces
  SET team_member_count = team_member_count + 1
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', v_member_id,
    'role', p_role
  );
END;
$$;

-- =====================================================================
-- Function to remove team member
-- =====================================================================

CREATE OR REPLACE FUNCTION remove_team_member_from_workspace(
  p_workspace_id TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member workspace_members%ROWTYPE;
BEGIN
  -- Get member
  SELECT * INTO v_member
  FROM workspace_members
  WHERE id = p_workspace_id::uuid
    AND user_id = p_user_id;

  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  -- Cannot remove owner
  IF v_member.role = 'owner' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove workspace owner');
  END IF;

  -- Remove member
  DELETE FROM workspace_members
  WHERE id = v_member.id;

  -- Decrement team member count
  UPDATE workspaces
  SET team_member_count = GREATEST(0, team_member_count - 1)
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================================
-- Update RLS policies for team member access
-- =====================================================================

-- Team members can view data but not modify critical settings
DROP POLICY IF EXISTS "Team members read access" ON workspace_accounts;
CREATE POLICY "Team members read access" ON workspace_accounts
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'member', 'viewer')
    )
  );

-- Only owner can modify accounts
DROP POLICY IF EXISTS "Only owner modifies accounts" ON workspace_accounts;
CREATE POLICY "Only owner modifies accounts" ON workspace_accounts
  FOR ALL TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND can_connect_accounts = true
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND can_connect_accounts = true
    )
  );

-- =====================================================================
-- Permission matrix view
-- =====================================================================

CREATE OR REPLACE VIEW workspace_member_permissions AS
SELECT
  wm.workspace_id,
  wm.user_id,
  wm.role,
  wm.can_connect_accounts,

  -- Permissions
  (wm.role = 'owner') as can_delete_workspace,
  (wm.role IN ('owner', 'admin')) as can_manage_campaigns,
  (wm.role IN ('owner', 'admin', 'member')) as can_edit_prospects,
  (wm.role IN ('owner', 'admin', 'member', 'viewer')) as can_view_data,
  (wm.role IN ('owner', 'admin')) as can_manage_team,
  (wm.role = 'owner') as can_connect_accounts_permission,
  (wm.role = 'owner') as can_send_messages

FROM workspace_members wm;

GRANT SELECT ON workspace_member_permissions TO authenticated;

COMMENT ON VIEW workspace_member_permissions IS 'Defines what each role can do in workspace';

-- =====================================================================
-- Billing tier limits
-- =====================================================================

-- Update max team members based on workspace tier
CREATE OR REPLACE FUNCTION update_workspace_team_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Default limits based on tier (you can customize)
  -- FREE: 0 team members (owner only)
  -- STARTUP: 2 team members
  -- SME: 5 team members
  -- ENTERPRISE: Unlimited (set to 50)

  IF NEW.tier_name = 'free' THEN
    NEW.max_team_members := 0;
  ELSIF NEW.tier_name = 'startup' THEN
    NEW.max_team_members := 2;
  ELSIF NEW.tier_name = 'sme' THEN
    NEW.max_team_members := 5;
  ELSIF NEW.tier_name = 'enterprise' THEN
    NEW.max_team_members := 50;
  ELSE
    NEW.max_team_members := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- Note: Actual trigger would be on workspace_tiers table
-- Placeholder for when you implement tiered billing

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON FUNCTION add_team_member_to_workspace IS 'Add team member to personal workspace (viewer/admin/member role)';
COMMENT ON FUNCTION remove_team_member_from_workspace IS 'Remove team member from workspace (cannot remove owner)';
COMMENT ON FUNCTION can_add_team_member IS 'Check if workspace can add more team members (billing limit)';

-- =====================================================================
-- Migration: Set existing members
-- =====================================================================

-- For existing personal workspaces with multiple members:
-- Mark the owner and set others as viewers by default
DO $$
DECLARE
  v_workspace workspaces%ROWTYPE;
BEGIN
  FOR v_workspace IN
    SELECT * FROM workspaces
    WHERE workspace_type = 'personal'
  LOOP
    -- Ensure owner can connect accounts
    UPDATE workspace_members
    SET can_connect_accounts = true
    WHERE workspace_id = v_workspace.id
      AND user_id = v_workspace.owner_id;

    -- Set all non-owners to viewer by default
    UPDATE workspace_members
    SET
      role = 'viewer',
      can_connect_accounts = false
    WHERE workspace_id = v_workspace.id
      AND user_id != v_workspace.owner_id
      AND role NOT IN ('owner');

    -- Update team member count
    UPDATE workspaces
    SET team_member_count = (
      SELECT COUNT(*) FROM workspace_members
      WHERE workspace_id = v_workspace.id
        AND user_id != v_workspace.owner_id
    )
    WHERE id = v_workspace.id;
  END LOOP;
END $$;

COMMIT;
