-- Fix RLS Policies: Remove Clerk ID dependency, use Supabase Auth directly
-- This fixes member access issues caused by Clerk ID references

-- Drop existing policies that reference clerk_id
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can update their workspace" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can delete their workspace" ON workspaces;
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_members;

-- Remove clerk_id column from users table if it exists
ALTER TABLE users DROP COLUMN IF EXISTS clerk_id;

-- Create new RLS policies using Supabase auth.uid() directly
-- Users table policies
CREATE POLICY "Users can view their own profile" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

-- Workspaces table policies
CREATE POLICY "Users can view workspaces they belong to" 
  ON workspaces FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = workspaces.id 
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace owners can update their workspace" 
  ON workspaces FOR UPDATE 
  USING (owner_id = auth.uid());

CREATE POLICY "Workspace owners can delete their workspace" 
  ON workspaces FOR DELETE 
  USING (owner_id = auth.uid());

-- Workspace members table policies
CREATE POLICY "Users can view members of their workspaces" 
  ON workspace_members FOR SELECT 
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage members" 
  ON workspace_members FOR ALL 
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Add policy for users to insert themselves into workspace_members (for invitations)
CREATE POLICY "Users can join workspaces via invitation" 
  ON workspace_members FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Update any other tables that reference users via auth system
-- Fix foreign key constraints to point to auth.uid() instead of users.id where needed

-- Update workspace owner references to use auth.uid()
UPDATE workspaces SET owner_id = auth.uid() WHERE owner_id IS NULL;

-- Ensure workspace_members.user_id uses auth.uid()
-- This will be handled by the application layer during user operations

-- Add indexes for better performance with new auth structure
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_auth ON workspace_members(user_id) WHERE user_id = auth.uid();
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_auth ON workspaces(owner_id) WHERE owner_id = auth.uid();

COMMENT ON MIGRATION IS 'Remove Clerk ID dependencies and fix RLS policies to use Supabase Auth directly. This resolves member access issues.';