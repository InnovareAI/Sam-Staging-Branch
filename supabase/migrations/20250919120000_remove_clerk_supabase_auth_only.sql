-- Complete Clerk Removal and Supabase Auth Migration
-- This migration removes all Clerk dependencies and establishes Supabase Auth as the sole authentication system

-- Drop existing policies that reference clerk_id or non-existent users table
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can update their workspace" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can delete their workspace" ON workspaces;
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_members;
DROP POLICY IF EXISTS "Users can join workspaces via invitation" ON workspace_members;

-- Drop any additional policies that reference clerk_id
DROP POLICY IF EXISTS "Users can manage workspace accounts" ON workspace_accounts;
DROP POLICY IF EXISTS "Users can access workspace prospects" ON workspace_prospects;
DROP POLICY IF EXISTS "Users can access prospect contact history" ON prospect_contact_history;
DROP POLICY IF EXISTS "Users can manage own account sessions" ON workspace_account_sessions;
DROP POLICY IF EXISTS "Users can access workspace assignment rules" ON prospect_assignment_rules;

-- Create users table that bridges auth.users to application data
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED,
  avatar_url TEXT,
  default_workspace_id UUID,
  current_workspace_id UUID,
  is_admin BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints for workspace references after workspaces table exists
-- These will be added later if workspaces table doesn't exist yet

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_default_workspace ON users(default_workspace_id);
CREATE INDEX IF NOT EXISTS idx_users_current_workspace ON users(current_workspace_id);

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS Policies using Supabase Auth only
-- Users can view and update their own profile
CREATE POLICY "Users can view their own profile" 
  ON users FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
  ON users FOR UPDATE 
  USING (auth.uid() = id);

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can insert their own profile" 
  ON users FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- Fix workspaces RLS policies to use auth.uid() directly
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

CREATE POLICY "Users can create workspaces" 
  ON workspaces FOR INSERT 
  WITH CHECK (owner_id = auth.uid());

-- Fix workspace members RLS policies
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

CREATE POLICY "Users can join workspaces via invitation" 
  ON workspace_members FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Create workspace_accounts table with proper Supabase Auth integration
CREATE TABLE IF NOT EXISTS workspace_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Account identification
    account_type TEXT NOT NULL CHECK (account_type IN ('linkedin', 'email', 'whatsapp', 'instagram')),
    account_identifier TEXT NOT NULL, -- Email address, LinkedIn profile URL, etc.
    account_name TEXT, -- Display name for the account
    
    -- Account connection details
    unipile_account_id TEXT, -- Connection to Unipile
    connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'suspended')),
    connection_details JSONB DEFAULT '{}', -- Platform-specific connection info
    
    -- Usage tracking
    daily_message_count INTEGER DEFAULT 0,
    daily_message_limit INTEGER DEFAULT 50, -- Per-account daily limit
    monthly_message_count INTEGER DEFAULT 0,
    last_message_sent_at TIMESTAMPTZ,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false, -- One primary account per type per user
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(workspace_id, user_id, account_type, account_identifier)
);

-- Add unique constraint for primary accounts
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_account_per_user_type 
ON workspace_accounts(workspace_id, user_id, account_type) 
WHERE is_primary = true;

-- Create indexes for workspace_accounts
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_workspace_user ON workspace_accounts(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_type_active ON workspace_accounts(account_type, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_unipile ON workspace_accounts(unipile_account_id) WHERE unipile_account_id IS NOT NULL;

-- Enable RLS on workspace_accounts
ALTER TABLE workspace_accounts ENABLE ROW LEVEL SECURITY;

-- RLS policy for workspace_accounts
CREATE POLICY "Users can manage accounts in their workspaces" ON workspace_accounts
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Create integrations table for backward compatibility
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('linkedin', 'email', 'google', 'microsoft')),
    account_identifier TEXT NOT NULL,
    account_name TEXT,
    credentials JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    status TEXT DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider, account_identifier)
);

-- Enable RLS on integrations
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- RLS policy for integrations
CREATE POLICY "Users can manage their own integrations" ON integrations
    FOR ALL USING (user_id = auth.uid());

-- Function to auto-create user profile on first auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

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

CREATE TRIGGER update_workspace_accounts_updated_at
  BEFORE UPDATE ON workspace_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Service role policies for API operations (allow backend to manage all data)
CREATE POLICY "Service role can manage all users" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all workspaces" ON workspaces
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all workspace_members" ON workspace_members
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all workspace_accounts" ON workspace_accounts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all integrations" ON integrations
  FOR ALL USING (auth.role() = 'service_role');

-- Fix any existing workspace references
-- Update workspaces to reference auth.users directly
UPDATE workspaces SET owner_id = (
  SELECT au.id FROM auth.users au WHERE au.email = 'test@example.com'
) WHERE owner_id IS NULL;

-- Comments for documentation
COMMENT ON TABLE users IS 'Application user profiles linked to auth.users - Supabase Auth only, no Clerk';
COMMENT ON TABLE workspace_accounts IS 'Per-workspace account management for LinkedIn, email, etc.';
COMMENT ON TABLE integrations IS 'Legacy integration storage for backward compatibility';
COMMENT ON FUNCTION handle_new_user IS 'Auto-creates user profile when auth.users record is created';

-- Migration complete message
COMMENT ON SCHEMA public IS 'Clerk completely removed, Supabase Auth only implementation complete';