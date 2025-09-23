#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('📋 CREATING WORKSPACE TABLES');
console.log('============================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createWorkspaceTables() {
  console.log('🏗️  Creating workspaces table...');
  
  try {
    const { error: workspaceError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.workspaces (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT UNIQUE NOT NULL,
          owner_id UUID NOT NULL,
          organization_id UUID,
          settings JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });
    
    if (workspaceError) {
      console.log('❌ Error creating workspaces table:', workspaceError.message);
      return false;
    }
    
    console.log('✅ Workspaces table created successfully');
    
    console.log('🏗️  Creating workspace_members table...');
    
    const { error: membersError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS public.workspace_members (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          workspace_id UUID NOT NULL,
          user_id UUID NOT NULL,
          role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
          joined_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(workspace_id, user_id)
        );
      `
    });
    
    if (membersError) {
      console.log('❌ Error creating workspace_members table:', membersError.message);
      return false;
    }
    
    console.log('✅ Workspace_members table created successfully');
    
    console.log('🔧 Creating indexes...');
    
    const { error: indexError } = await supabase.rpc('exec_sql', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
        CREATE INDEX IF NOT EXISTS idx_workspaces_organization_id ON public.workspaces(organization_id);
        CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
        CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
      `
    });
    
    if (indexError) {
      console.log('❌ Error creating indexes:', indexError.message);
    } else {
      console.log('✅ Indexes created successfully');
    }
    
    return true;
    
  } catch (error) {
    console.log('❌ Exception creating tables:', error.message);
    return false;
  }
}

async function verifyTables() {
  console.log('\n🔍 Verifying tables...');
  
  try {
    // Test workspaces table
    const { data: workspaceTest, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .limit(0);
      
    if (workspaceError) {
      console.log('❌ Workspaces table verification failed:', workspaceError.message);
      return false;
    }
    
    console.log('✅ Workspaces table verified');
    
    // Test workspace_members table
    const { data: membersTest, error: membersError } = await supabase
      .from('workspace_members')
      .select('*')
      .limit(0);
      
    if (membersError) {
      console.log('❌ Workspace_members table verification failed:', membersError.message);
      return false;
    }
    
    console.log('✅ Workspace_members table verified');
    
    return true;
    
  } catch (error) {
    console.log('❌ Exception verifying tables:', error.message);
    return false;
  }
}

async function main() {
  const created = await createWorkspaceTables();
  
  if (!created) {
    console.log('\n❌ Failed to create workspace tables');
    return;
  }
  
  const verified = await verifyTables();
  
  if (!verified) {
    console.log('\n❌ Failed to verify workspace tables');
    return;
  }
  
  console.log('\n🎉 WORKSPACE TABLES READY!');
  console.log('===========================');
  console.log('✅ Tables created and verified');
  console.log('✅ Ready for workspace creation');
}

main().catch(console.error);