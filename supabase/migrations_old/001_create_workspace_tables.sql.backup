-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  image_url TEXT,
  default_workspace_id UUID,
  current_workspace_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
  UNIQUE(workspace_id, user_id)
);

-- Add foreign key constraints for user workspace references
ALTER TABLE users 
  ADD CONSTRAINT fk_default_workspace 
  FOREIGN KEY (default_workspace_id) 
  REFERENCES workspaces(id) 
  ON DELETE SET NULL;

ALTER TABLE users 
  ADD CONSTRAINT fk_current_workspace 
  FOREIGN KEY (current_workspace_id) 
  REFERENCES workspaces(id) 
  ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile" 
  ON users FOR SELECT 
  USING (auth.uid()::text = clerk_id);

CREATE POLICY "Users can update their own profile" 
  ON users FOR UPDATE 
  USING (auth.uid()::text = clerk_id);

-- RLS Policies for workspaces table
CREATE POLICY "Users can view workspaces they belong to" 
  ON workspaces FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = workspaces.id 
      AND workspace_members.user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "Workspace owners can update their workspace" 
  ON workspaces FOR UPDATE 
  USING (
    owner_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Workspace owners can delete their workspace" 
  ON workspaces FOR DELETE 
  USING (
    owner_id IN (
      SELECT id FROM users WHERE clerk_id = auth.uid()::text
    )
  );

-- RLS Policies for workspace_members table
CREATE POLICY "Users can view members of their workspaces" 
  ON workspace_members FOR SELECT 
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "Workspace admins can manage members" 
  ON workspace_members FOR ALL 
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
      )
      AND role IN ('owner', 'admin')
    )
  );

-- Function to generate workspace slug
CREATE OR REPLACE FUNCTION generate_workspace_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug = LOWER(REGEXP_REPLACE(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    -- Ensure uniqueness by appending a number if necessary
    WHILE EXISTS (SELECT 1 FROM workspaces WHERE slug = NEW.slug AND id != NEW.id) LOOP
      NEW.slug = NEW.slug || '-' || FLOOR(RANDOM() * 1000)::TEXT;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate workspace slug
CREATE TRIGGER generate_workspace_slug_trigger
  BEFORE INSERT OR UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION generate_workspace_slug();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();