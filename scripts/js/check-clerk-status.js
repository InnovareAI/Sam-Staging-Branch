#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking Clerk References Status...');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTableColumns() {
  console.log('\n📋 Checking table schemas for Clerk columns...');
  
  try {
    // Check if users table has clerk_id column
    const { data: usersColumns, error: usersError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users')
      .eq('column_name', 'clerk_id');
    
    if (usersError) {
      console.error('❌ Error checking users table:', usersError.message);
    } else {
      console.log('👤 Users table clerk_id column:', usersColumns.length > 0 ? '❌ EXISTS' : '✅ REMOVED');
    }

    // Check if workspaces table has clerk_id column
    const { data: workspacesColumns, error: workspacesError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'workspaces')
      .eq('column_name', 'clerk_id');
    
    if (workspacesError) {
      console.error('❌ Error checking workspaces table:', workspacesError.message);
    } else {
      console.log('🏢 Workspaces table clerk_id column:', workspacesColumns.length > 0 ? '❌ EXISTS' : '✅ REMOVED');
    }

  } catch (err) {
    console.error('❌ Error checking table columns:', err.message);
  }
}

async function checkUsers() {
  console.log('\n👥 Checking users table status...');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .limit(5);
    
    if (error) {
      console.error('❌ Error accessing users table:', error.message);
    } else {
      console.log(`✅ Users table accessible with ${users.length} sample records`);
      if (users.length > 0) {
        console.log('📄 Sample user:', {
          id: users[0].id,
          email: users[0].email,
          first_name: users[0].first_name
        });
      }
    }
  } catch (err) {
    console.error('❌ Error checking users:', err.message);
  }
}

async function checkWorkspaces() {
  console.log('\n🏢 Checking workspaces table status...');
  
  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, name, owner_id')
      .limit(5);
    
    if (error) {
      console.error('❌ Error accessing workspaces table:', error.message);
    } else {
      console.log(`✅ Workspaces table accessible with ${workspaces.length} sample records`);
      if (workspaces.length > 0) {
        console.log('📄 Sample workspace:', {
          id: workspaces[0].id,
          name: workspaces[0].name,
          owner_id: workspaces[0].owner_id
        });
      }
    }
  } catch (err) {
    console.error('❌ Error checking workspaces:', err.message);
  }
}

async function checkAuth() {
  console.log('\n🔐 Checking authentication status...');
  
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('🔓 No active user session (normal for service key)');
    } else {
      console.log('🔑 Session status:', session ? 'Active' : 'None');
    }

    // Check auth.users table
    const { data: authUsers, error: authError } = await supabase
      .from('auth.users')
      .select('id, email')
      .limit(5);
    
    if (authError) {
      console.log('⚠️  Cannot access auth.users directly (normal with RLS)');
    } else {
      console.log(`✅ Auth users accessible with ${authUsers.length} records`);
    }

  } catch (err) {
    console.log('⚠️  Auth check limited by RLS policies (normal)');
  }
}

async function main() {
  console.log('\n🚀 Starting Clerk Status Check...\n');
  
  await checkTableColumns();
  await checkUsers();
  await checkWorkspaces();
  await checkAuth();
  
  console.log('\n🎯 Status Check Complete!');
  console.log('📊 This report shows the current state of Clerk removal');
  console.log('✅ Green indicators mean Clerk references are successfully removed');
  console.log('❌ Red indicators mean Clerk references still exist and need cleanup');
}

main().catch(console.error);