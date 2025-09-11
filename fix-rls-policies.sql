-- Fix infinite recursion in RLS policies
-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can access workspaces they own or are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can manage their own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Super admins can manage all workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Super admins can manage all workspace members" ON workspace_members;

-- Create simplified RLS policies for workspaces (no circular dependency)
CREATE POLICY "Users can select workspaces they own or are members of"
  ON workspaces FOR SELECT
  USING (
    owner_id = auth.uid() OR 
    id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own workspaces"
  ON workspaces FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Super admins can manage all workspaces"
  ON workspaces FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- Create NON-CIRCULAR RLS policies for workspace_members
-- Allow users to see memberships for workspaces they own (direct ownership check)
CREATE POLICY "Users can view workspace members they own"
  ON workspace_members FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    ) OR
    user_id = auth.uid()
  );

-- Allow users to insert/update/delete members for workspaces they own directly
CREATE POLICY "Users can manage members of workspaces they own"
  ON workspace_members FOR INSERT, UPDATE, DELETE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Super admins can do anything
CREATE POLICY "Super admins can manage all workspace members"
  ON workspace_members FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );