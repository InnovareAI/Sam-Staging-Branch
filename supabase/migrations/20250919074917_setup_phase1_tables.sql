-- Phase 1 Setup: Core tables for SAM AI Platform
-- Uses Supabase auth instead of Clerk

-- Create workspaces table (Phase 1 requirement)
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company TEXT DEFAULT 'InnovareAI' CHECK (company IN ('InnovareAI', '3cubedai')),
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workspace_members table (Phase 1 requirement)  
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(workspace_id, user_id)
);

-- Create workspace_invitations table (Phase 1 requirement)
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SAM conversation threads table (Phase 1 requirement)
CREATE TABLE IF NOT EXISTS sam_conversation_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  thread_type TEXT NOT NULL,
  prospect_name TEXT,
  prospect_company TEXT,
  prospect_linkedin_url TEXT,
  campaign_name TEXT,
  tags TEXT[],
  priority TEXT DEFAULT 'medium',
  sales_methodology TEXT DEFAULT 'meddic',
  status TEXT DEFAULT 'active',
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create SAM conversation messages table (Phase 1 requirement)
CREATE TABLE IF NOT EXISTS sam_conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create knowledge base table (Phase 1 requirement)
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_company ON workspaces(company);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_sam_threads_user_id ON sam_conversation_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_threads_workspace_id ON sam_conversation_threads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_threads_last_active ON sam_conversation_threads(last_active_at);
CREATE INDEX IF NOT EXISTS idx_sam_messages_thread_id ON sam_conversation_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_sam_messages_created_at ON sam_conversation_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_workspace ON knowledge_base(workspace_id);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;  
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspaces
DROP POLICY IF EXISTS "Users can access workspaces they own or are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can manage their own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Super admins can manage all workspaces" ON workspaces;

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

-- RLS Policies for workspace_members
DROP POLICY IF EXISTS "Users can manage workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Super admins can manage all workspace members" ON workspace_members;

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

-- RLS Policies for SAM conversation threads
DROP POLICY IF EXISTS "Users can only access their own threads" ON sam_conversation_threads;

CREATE POLICY "Users can only access their own threads"
  ON sam_conversation_threads FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for SAM conversation messages
DROP POLICY IF EXISTS "Users can only access their own messages" ON sam_conversation_messages;

CREATE POLICY "Users can only access their own messages"
  ON sam_conversation_messages FOR ALL
  USING (
    thread_id IN (
      SELECT id FROM sam_conversation_threads 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for knowledge base
DROP POLICY IF EXISTS "Users can access workspace knowledge base" ON knowledge_base;

CREATE POLICY "Users can access workspace knowledge base"
  ON knowledge_base FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces 
      WHERE owner_id = auth.uid() OR id IN (
        SELECT workspace_id FROM workspace_members 
        WHERE user_id = auth.uid()
      )
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
DROP TRIGGER IF EXISTS generate_workspace_slug_trigger ON workspaces;
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
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sam_threads_updated_at ON sam_conversation_threads;
CREATE TRIGGER update_sam_threads_updated_at
  BEFORE UPDATE ON sam_conversation_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_sam_messages_updated_at ON sam_conversation_messages;
CREATE TRIGGER update_sam_messages_updated_at
  BEFORE UPDATE ON sam_conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();