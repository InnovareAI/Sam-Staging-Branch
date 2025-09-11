import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: NextRequest) {
  const client = new Client({
    host: 'aws-0-us-west-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.latxadqrvrrrcvkktrog',
    password: 'aXjf38f9LS4vQF5L'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const results = [];

    // Create tables
    try {
      const createTablesSQL = `
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

        CREATE TABLE IF NOT EXISTS workspace_members (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
          joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
          UNIQUE(workspace_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
        CREATE INDEX IF NOT EXISTS idx_workspaces_company ON workspaces(company);
        CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

        ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
        ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
      `;

      await client.query(createTablesSQL);
      results.push({ operation: 'create_tables', success: true });
    } catch (error) {
      results.push({
        operation: 'create_tables',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Drop existing policies
    try {
      const dropPoliciesSQL = `
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
      `;

      await client.query(dropPoliciesSQL);
      results.push({ operation: 'drop_policies', success: true });
    } catch (error) {
      results.push({
        operation: 'drop_policies',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Create workspace policies (order matters - super admin first)
    try {
      const workspacePoliciesSQL = `
        CREATE POLICY "Super admins can manage all workspaces"
          ON workspaces FOR ALL
          USING (
            auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
          );

        CREATE POLICY "Users can manage their own workspaces"
          ON workspaces FOR ALL
          USING (owner_id = auth.uid());

        CREATE POLICY "Users can select workspaces they own or are members of"
          ON workspaces FOR SELECT
          USING (
            owner_id = auth.uid() OR 
            id IN (
              SELECT workspace_id FROM workspace_members 
              WHERE user_id = auth.uid()
            )
          );
      `;

      await client.query(workspacePoliciesSQL);
      results.push({ operation: 'workspace_policies', success: true });
    } catch (error) {
      results.push({
        operation: 'workspace_policies',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Create member policies (simplified to avoid recursion)
    try {
      const memberPoliciesSQL = `
        CREATE POLICY "Super admins can manage all workspace members"
          ON workspace_members FOR ALL
          USING (
            auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
          );

        CREATE POLICY "Users can view their own memberships"
          ON workspace_members FOR SELECT
          USING (user_id = auth.uid());

        CREATE POLICY "Workspace owners can manage members"
          ON workspace_members FOR INSERT, UPDATE, DELETE
          USING (
            workspace_id IN (
              SELECT id FROM workspaces WHERE owner_id = auth.uid()
            )
          );
      `;

      await client.query(memberPoliciesSQL);
      results.push({ operation: 'member_policies', success: true });
    } catch (error) {
      results.push({
        operation: 'member_policies',
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
      { error: 'Database connection failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  } finally {
    await client.end();
  }
}