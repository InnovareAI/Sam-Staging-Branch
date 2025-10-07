import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with service role for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = [];

    // Create workspaces table
    try {
      const { error: workspacesError } = await adminSupabase.rpc('exec_sql', {
        query: `
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
        `
      });

      results.push({
        table: 'workspaces',
        success: !workspacesError,
        error: workspacesError?.message
      });
    } catch (error) {
      results.push({
        table: 'workspaces',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Create workspace_members table
    try {
      const { error: membersError } = await adminSupabase.rpc('exec_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS workspace_members (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
            joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            UNIQUE(workspace_id, user_id)
          );
        `
      });

      results.push({
        table: 'workspace_members',
        success: !membersError,
        error: membersError?.message
      });
    } catch (error) {
      results.push({
        table: 'workspace_members',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Create indexes
    try {
      const { error: indexError } = await adminSupabase.rpc('exec_sql', {
        query: `
          CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
          CREATE INDEX IF NOT EXISTS idx_workspaces_company ON workspaces(company);
          CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
          CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
        `
      });

      results.push({
        table: 'indexes',
        success: !indexError,
        error: indexError?.message
      });
    } catch (error) {
      results.push({
        table: 'indexes',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Enable RLS
    try {
      const { error: rlsError } = await adminSupabase.rpc('exec_sql', {
        query: `
          ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
          ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
        `
      });

      results.push({
        table: 'rls_enable',
        success: !rlsError,
        error: rlsError?.message
      });
    } catch (error) {
      results.push({
        table: 'rls_enable',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Create RLS policies
    try {
      const { error: policiesError } = await adminSupabase.rpc('exec_sql', {
        query: `
          DROP POLICY IF EXISTS "Users can access workspaces they own or are members of" ON workspaces;
          DROP POLICY IF EXISTS "Super admins can manage all workspaces" ON workspaces;
          DROP POLICY IF EXISTS "Users can manage workspace members" ON workspace_members;
          DROP POLICY IF EXISTS "Super admins can manage all workspace members" ON workspace_members;
          
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
        `
      });

      results.push({
        table: 'rls_policies',
        success: !policiesError,
        error: policiesError?.message
      });
    } catch (error) {
      results.push({
        table: 'rls_policies',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return NextResponse.json({
      success: successCount === totalCount,
      message: `Database setup completed: ${successCount}/${totalCount} operations successful`,
      timestamp: new Date().toISOString(),
      results
    });

  } catch (error) {
    console.error('Database setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}