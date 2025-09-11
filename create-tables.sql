-- SAM AI Platform - Critical Database Tables
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql

-- Create SAM Conversation Threads Table
CREATE TABLE IF NOT EXISTS sam_conversation_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID,
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

-- Create SAM Conversation Messages Table
CREATE TABLE IF NOT EXISTS sam_conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_sam_threads_user_id ON sam_conversation_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_threads_last_active ON sam_conversation_threads(last_active_at);
CREATE INDEX IF NOT EXISTS idx_sam_messages_thread_id ON sam_conversation_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_sam_messages_created_at ON sam_conversation_messages(created_at);

-- Enable Row Level Security
ALTER TABLE sam_conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Data Security
CREATE POLICY IF NOT EXISTS "Users can only access their own threads"
  ON sam_conversation_threads FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can only access their own messages"
  ON sam_conversation_messages FOR ALL
  USING (
    thread_id IN (
      SELECT id FROM sam_conversation_threads 
      WHERE user_id = auth.uid()
    )
  );

-- Create Organizations Table (for multi-tenant support)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL CHECK (company IN ('InnovareAI', '3cubedai')),
  domain TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Workspace Invitations Table
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  token UUID DEFAULT gen_random_uuid(),
  company TEXT NOT NULL CHECK (company IN ('InnovareAI', '3cubedai')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add company field to existing workspaces table if it doesn't exist
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'InnovareAI' CHECK (company IN ('InnovareAI', '3cubedai'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_company ON organizations(company);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_company ON workspaces(company);

-- Enable RLS on new tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organizations (super admin access only)
CREATE POLICY IF NOT EXISTS "Super admins can manage organizations"
  ON organizations FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- Create RLS policies for workspace invitations
CREATE POLICY IF NOT EXISTS "Super admins can manage invitations"
  ON workspace_invitations FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- Create RLS policy for workspaces with company support
DROP POLICY IF EXISTS "Users can only access their own workspaces" ON workspaces;
CREATE POLICY IF NOT EXISTS "Users can access workspaces they own or are members of"
  ON workspaces FOR SELECT
  USING (
    owner_id = auth.uid() OR 
    id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Super admins can manage all workspaces"
  ON workspaces FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- Verify Tables Created
SELECT 'sam_conversation_threads' as table_name, count(*) as record_count FROM sam_conversation_threads
UNION ALL
SELECT 'sam_conversation_messages' as table_name, count(*) as record_count FROM sam_conversation_messages
UNION ALL
SELECT 'organizations' as table_name, count(*) as record_count FROM organizations
UNION ALL
SELECT 'workspace_invitations' as table_name, count(*) as record_count FROM workspace_invitations
UNION ALL
SELECT 'workspaces' as table_name, count(*) as record_count FROM workspaces;