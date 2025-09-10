-- Migration to update schema from Clerk to Supabase Auth compatibility
-- This updates the existing tables to work with both Clerk (legacy) and Supabase Auth

-- First, update the users table to be compatible with Supabase Auth
-- Add columns that might be missing for Supabase Auth
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS current_workspace_id UUID,
  ALTER COLUMN clerk_id DROP NOT NULL,
  ALTER COLUMN id SET DEFAULT auth.uid()::uuid;

-- Make clerk_id optional since we're moving to Supabase Auth
-- The id field will now be the primary identifier (Supabase Auth user ID)

-- Update RLS policies for Supabase Auth
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- New RLS policy for Supabase Auth
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role can manage all users" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- Update organizations table to be compatible with Supabase
-- Make clerk_org_id optional since we'll use regular UUID id for Supabase
ALTER TABLE public.organizations 
  ALTER COLUMN clerk_org_id DROP NOT NULL,
  ALTER COLUMN created_by TYPE UUID USING created_by::uuid;

-- Update RLS policies for organizations with Supabase Auth
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Organization admins can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Service role can manage organizations" ON public.organizations;

-- New RLS policies for organizations with Supabase Auth
CREATE POLICY "Users can view their organizations" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can update" ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM public.user_organizations 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role can manage organizations" ON public.organizations
  FOR ALL USING (auth.role() = 'service_role');

-- Update user_organizations junction table RLS
CREATE POLICY "Users can view their organization memberships" ON public.user_organizations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage memberships" ON public.user_organizations
  FOR ALL USING (auth.role() = 'service_role');

-- Create or update workspaces table for workspace management
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for workspaces
CREATE INDEX IF NOT EXISTS idx_workspaces_organization_id ON public.workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);

-- Enable RLS on workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspaces
CREATE POLICY "Users can view workspaces they belong to" ON public.workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid()
    ) OR owner_id = auth.uid()
  );

CREATE POLICY "Workspace owners can update workspaces" ON public.workspaces
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Service role can manage workspaces" ON public.workspaces
  FOR ALL USING (auth.role() = 'service_role');

-- Create workspace_members table for workspace access control
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- member, admin, owner
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Create indexes for workspace_members
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);

-- Enable RLS on workspace_members
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspace_members
CREATE POLICY "Users can view workspace memberships" ON public.workspace_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Service role can manage workspace members" ON public.workspace_members
  FOR ALL USING (auth.role() = 'service_role');

-- Add workspace relationship to users table
ALTER TABLE public.users 
  ADD CONSTRAINT fk_users_current_workspace 
  FOREIGN KEY (current_workspace_id) 
  REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- Update triggers for new tables
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.workspaces IS 'Workspaces for organizing user work within organizations';
COMMENT ON TABLE public.workspace_members IS 'Junction table for workspace membership and roles';
COMMENT ON COLUMN public.users.current_workspace_id IS 'Users current active workspace';