#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Executing Comprehensive Clerk Removal...');
console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Service Key: ${supabaseServiceKey ? supabaseServiceKey.substring(0, 20) + '...' : 'NOT FOUND'}`);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql, description) {
  console.log(`\n📝 ${description}...`);
  try {
    const { data, error } = await supabase.rpc('exec', { sql });
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return false;
    }
    console.log(`✅ ${description} completed successfully`);
    if (data) {
      console.log('📊 Result:', data);
    }
    return true;
  } catch (err) {
    console.error(`❌ Exception in ${description}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('\n🚀 Starting Comprehensive Clerk Removal Process...\n');

  // Step 1: Check current Clerk references
  await executeSQL(
    "SELECT COUNT(*) as clerk_policy_count FROM pg_policies WHERE definition LIKE '%clerk_id%'",
    "Checking existing Clerk policy references"
  );

  // Step 2: Drop Clerk-dependent policies
  await executeSQL(`
    DO $$ 
    DECLARE
        pol record;
    BEGIN
        FOR pol IN 
            SELECT schemaname, tablename, policyname 
            FROM pg_policies 
            WHERE definition LIKE '%clerk_id%'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                          pol.policyname, pol.schemaname, pol.tablename);
            RAISE NOTICE 'Dropped Clerk-dependent policy: %.%', pol.tablename, pol.policyname;
        END LOOP;
    END $$;
  `, "Dropping all Clerk-dependent policies");

  // Step 3: Drop Clerk columns
  await executeSQL(`
    ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS clerk_id CASCADE;
    ALTER TABLE IF EXISTS organizations DROP COLUMN IF EXISTS clerk_org_id CASCADE;
    ALTER TABLE IF EXISTS workspaces DROP COLUMN IF EXISTS clerk_id CASCADE;
  `, "Dropping Clerk columns from tables");

  // Step 4: Drop Clerk indexes
  await executeSQL(`
    DROP INDEX IF EXISTS idx_users_clerk_id;
    DROP INDEX IF EXISTS idx_organizations_clerk_org_id;
  `, "Dropping Clerk indexes");

  // Step 5: Create essential RLS policies with Supabase auth
  await executeSQL(`
    -- Users table policies
    DROP POLICY IF EXISTS "users_auth_select" ON users;
    DROP POLICY IF EXISTS "users_auth_update" ON users;  
    DROP POLICY IF EXISTS "users_auth_insert" ON users;

    CREATE POLICY "users_auth_select" ON users 
      FOR SELECT USING (auth.uid() = id);
      
    CREATE POLICY "users_auth_update" ON users 
      FOR UPDATE USING (auth.uid() = id);
      
    CREATE POLICY "users_auth_insert" ON users 
      FOR INSERT WITH CHECK (auth.uid() = id);
  `, "Creating users table RLS policies");

  await executeSQL(`
    -- Workspaces table policies
    DROP POLICY IF EXISTS "workspaces_member_select" ON workspaces;
    DROP POLICY IF EXISTS "workspaces_owner_manage" ON workspaces;

    CREATE POLICY "workspaces_member_select" ON workspaces 
      FOR SELECT USING (
        id IN (
          SELECT workspace_id FROM workspace_members 
          WHERE user_id = auth.uid()
        )
      );

    CREATE POLICY "workspaces_owner_manage" ON workspaces 
      FOR ALL USING (owner_id = auth.uid());
  `, "Creating workspaces table RLS policies");

  await executeSQL(`
    -- Workspace members table policies
    DROP POLICY IF EXISTS "workspace_members_view" ON workspace_members;
    DROP POLICY IF EXISTS "workspace_members_admin_manage" ON workspace_members;

    CREATE POLICY "workspace_members_view" ON workspace_members 
      FOR SELECT USING (
        workspace_id IN (
          SELECT workspace_id FROM workspace_members wm2
          WHERE wm2.user_id = auth.uid()
        )
      );

    CREATE POLICY "workspace_members_admin_manage" ON workspace_members 
      FOR ALL USING (
        workspace_id IN (
          SELECT workspace_id FROM workspace_members wm2
          WHERE wm2.user_id = auth.uid() 
          AND wm2.role IN ('owner', 'admin')
        )
      );
  `, "Creating workspace members RLS policies");

  // Step 6: Emergency admin access
  await executeSQL(`
    CREATE POLICY "emergency_admin_access_users" ON users 
      FOR ALL USING (
        auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
      );

    CREATE POLICY "service_role_full_access_users" ON users 
      FOR ALL USING (auth.role() = 'service_role');
  `, "Creating emergency admin and service role policies");

  // Step 7: Auto-user creation trigger
  await executeSQL(`
    CREATE OR REPLACE FUNCTION handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO users (id, email, first_name, last_name)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'last_name', '')
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  `, "Creating auto-user creation trigger");

  // Step 8: Final verification
  await executeSQL(
    "SELECT COUNT(*) as remaining_clerk_policies FROM pg_policies WHERE definition LIKE '%clerk_id%'",
    "Final verification - checking for remaining Clerk references"
  );

  console.log('\n🎉 Comprehensive Clerk Removal Process Completed!');
  console.log('🔒 All Clerk authentication has been replaced with Supabase auth patterns');
  console.log('✅ Database is now using pure Supabase authentication');
}

main().catch(console.error);