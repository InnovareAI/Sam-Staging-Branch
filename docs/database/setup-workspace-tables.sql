-- Create workspaces table if it doesn't exist
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company TEXT DEFAULT 'InnovareAI' CHECK (company IN ('InnovareAI', '3cubedai')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workspace_members table if it doesn't exist  
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(workspace_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_company ON workspaces(company);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can access workspaces they own or are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can manage their own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Super admins can manage all workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Super admins can manage all workspace members" ON workspace_members;

-- Create RLS policies for workspaces
CREATE POLICY "Users can access workspaces they own or are members of"
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

-- Create RLS policies for workspace_members
CREATE POLICY "Users can manage workspace members"
  ON workspace_members FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage all workspace members"
  ON workspace_members FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- Verify tables were created
SELECT 'workspaces' as table_name, count(*) as record_count FROM workspaces
UNION ALL
SELECT 'workspace_members' as table_name, count(*) as record_count FROM workspace_members;