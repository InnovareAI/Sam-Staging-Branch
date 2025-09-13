-- MANUAL FIX FOR RLS INFINITE RECURSION
-- Execute this SQL in the Supabase SQL Editor

-- Step 1: Temporarily disable RLS to prevent recursion
ALTER TABLE workspace_members DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can access workspaces they own or are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can manage their own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Super admins can manage all workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Super admins can manage all workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Users can view workspace members they own" ON workspace_members;
DROP POLICY IF EXISTS "Users can manage members of workspaces they own" ON workspace_members;
DROP POLICY IF EXISTS "Users can select workspaces they own or are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can view their own memberships" ON workspace_members;
DROP POLICY IF EXISTS "Workspace owners can manage members" ON workspace_members;

-- Step 3: Create simple, non-recursive policies for workspaces first
CREATE POLICY "Super admins can manage all workspaces"
  ON workspaces FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

CREATE POLICY "Users can manage their own workspaces"
  ON workspaces FOR ALL
  USING (owner_id = auth.uid());

-- Step 4: Re-enable RLS on workspace_members with simple policies
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all workspace members"
  ON workspace_members FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

CREATE POLICY "Users can view their own memberships"
  ON workspace_members FOR SELECT
  USING (user_id = auth.uid());

-- Step 5: Create workspace selection policy that uses workspace_members (now safe)
CREATE POLICY "Users can select workspaces they own or are members of"
  ON workspaces FOR SELECT
  USING (
    owner_id = auth.uid() OR 
    id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Step 6: Create workspace member management policy (direct ownership check only)
CREATE POLICY "Workspace owners can manage members"
  ON workspace_members FOR INSERT, UPDATE, DELETE
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Verification queries
SELECT 'Policies created successfully' as status;
SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('workspaces', 'workspace_members');