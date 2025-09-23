#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🏗️  FORCE CREATE WORKSPACE TABLES');
console.log('=================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createWorkspaceTablesDirectly() {
  console.log('📋 Creating workspace tables using admin client...');
  
  try {
    // Use the admin auth to create tables
    const adminSupabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    console.log('🔧 Attempting SQL execution via Supabase Admin...');
    
    // Method 1: Try using the SQL editor approach
    const createWorkspacesTableSQL = `
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
      
      CREATE TABLE IF NOT EXISTS public.workspace_members (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        workspace_id UUID NOT NULL,
        user_id UUID NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(workspace_id, user_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
      CREATE INDEX IF NOT EXISTS idx_workspaces_organization_id ON public.workspaces(organization_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
    `;
    
    console.log('📝 SQL to execute:');
    console.log(createWorkspacesTableSQL);
    
    // Try to find any SQL execution method
    console.log('\n🔍 Checking available RPC functions...');
    
    // Test if we can access the database at all
    const { data: orgTest, error: orgError } = await adminSupabase
      .from('organizations')
      .select('count')
      .limit(1);
      
    if (orgError) {
      console.log('❌ Cannot access database:', orgError.message);
      return false;
    }
    
    console.log('✅ Database access confirmed');
    
    // Since we can't execute raw SQL, let's check what happens with a direct create
    console.log('\n🧪 Testing direct table access...');
    
    const { data: wsTest, error: wsError } = await adminSupabase
      .from('workspaces')
      .select('*')
      .limit(0);
      
    if (wsError) {
      console.log('❌ Workspaces table does not exist:', wsError.message);
      console.log('\n💡 SOLUTION REQUIRED:');
      console.log('The workspace tables need to be created using:');
      console.log('1. Supabase Dashboard SQL Editor');
      console.log('2. Database migrations');
      console.log('3. Direct database access');
      console.log('\nSQL to run in Supabase Dashboard:');
      console.log('=====================================');
      console.log(createWorkspacesTableSQL);
      return false;
    }
    
    console.log('✅ Workspaces table already exists');
    return true;
    
  } catch (error) {
    console.log('❌ Exception:', error.message);
    return false;
  }
}

async function provideManualInstructions() {
  console.log('\n📋 MANUAL WORKSPACE TABLE CREATION REQUIRED');
  console.log('==========================================');
  console.log('\n🎯 TO RESTORE YOUR WORKSPACE DATA:');
  console.log('\n1. 🌐 Go to Supabase Dashboard:');
  console.log('   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog');
  console.log('\n2. 📝 Open SQL Editor');
  console.log('\n3. 🏗️  Run this SQL to create workspace tables:');
  console.log('\n```sql');
  console.log(`CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID NOT NULL,
  organization_id UUID,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_organization_id ON public.workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);`);
  console.log('\n```');
  console.log('\n4. 🔄 After creating tables, run: node scripts/js/restore-workspaces.js');
  console.log('\n5. 🌐 Your Super Admin panel will then show workspace data');
}

async function main() {
  const success = await createWorkspaceTablesDirectly();
  
  if (!success) {
    await provideManualInstructions();
  }
  
  console.log('\n🎯 IMMEDIATE NEXT STEPS:');
  console.log('=========================');
  console.log('• Create workspace tables using Supabase Dashboard');
  console.log('• Run workspace restoration script');
  console.log('• Verify data appears in Super Admin panel');
  console.log('• Test workspace creation and user invitation');
}

main().catch(console.error);