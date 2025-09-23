#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 ACTUAL DATABASE SCHEMA CHECK');
console.log('===============================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUsersTable() {
  console.log('👤 USERS TABLE:');
  console.log('===============');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(3);
    
    if (error) {
      console.log('❌ Error accessing users table:', error.message);
      return;
    }
    
    if (users.length > 0) {
      console.log('✅ Users table exists');
      console.log('🔑 Column names:', Object.keys(users[0]).join(', '));
      console.log('\n📄 Sample users:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.first_name || 'N/A'} ${user.last_name || ''} (${user.email})`);
        console.log(`   ID: ${user.id}`);
        if (user.clerk_id) console.log(`   Clerk ID: ${user.clerk_id}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log('');
      });
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function checkWorkspacesTable() {
  console.log('🏢 WORKSPACES TABLE:');
  console.log('===================');
  
  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log('❌ Error accessing workspaces table:', error.message);
      
      // Try alternative table names
      console.log('\n🔄 Trying alternative table names...');
      
      const altNames = ['workspace', 'user_workspaces', 'organizations'];
      for (const tableName of altNames) {
        try {
          const { data, error: altError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!altError) {
            console.log(`✅ Found table: ${tableName}`);
            if (data.length > 0) {
              console.log('🔑 Columns:', Object.keys(data[0]).join(', '));
            }
          }
        } catch (altErr) {
          // Ignore errors for non-existent tables
        }
      }
      return;
    }
    
    if (workspaces.length > 0) {
      console.log('✅ Workspaces table exists');
      console.log('🔑 Column names:', Object.keys(workspaces[0]).join(', '));
      console.log('\n📄 Sample workspaces:');
      workspaces.forEach((workspace, index) => {
        console.log(`${index + 1}. ${workspace.name || 'Unnamed'}`);
        console.log(`   ID: ${workspace.id}`);
        if (workspace.owner_id) console.log(`   Owner: ${workspace.owner_id}`);
        if (workspace.slug) console.log(`   Slug: ${workspace.slug}`);
        console.log('');
      });
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function checkWorkspaceMembersTable() {
  console.log('👥 WORKSPACE MEMBERS TABLE:');
  console.log('===========================');
  
  try {
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log('❌ Error accessing workspace_members table:', error.message);
      return;
    }
    
    if (members.length > 0) {
      console.log('✅ Workspace members table exists');
      console.log('🔑 Column names:', Object.keys(members[0]).join(', '));
      console.log('\n📄 Sample memberships:');
      members.forEach((member, index) => {
        console.log(`${index + 1}. User: ${member.user_id}`);
        console.log(`   Workspace: ${member.workspace_id}`);
        console.log(`   Role: ${member.role || 'N/A'}`);
        if (member.joined_at) console.log(`   Joined: ${new Date(member.joined_at).toLocaleDateString()}`);
        console.log('');
      });
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

async function listAllTables() {
  console.log('📋 DISCOVERING ALL TABLES:');
  console.log('===========================');
  
  // Try to access common table names
  const possibleTables = [
    'users', 'workspaces', 'workspace_members', 'workspace_invitations',
    'organizations', 'sam_conversation_threads', 'sam_conversation_messages',
    'knowledge_base', 'campaigns', 'campaign_prospects', 'integrations',
    'workspace_accounts', 'linkedin_contacts', 'bulk_upload_sessions'
  ];
  
  const existingTables = [];
  
  for (const tableName of possibleTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (!error) {
        existingTables.push(tableName);
        const columnCount = data.length > 0 ? Object.keys(data[0]).length : 0;
        console.log(`✅ ${tableName} (${data.length} sample records, ${columnCount} columns)`);
      }
    } catch (err) {
      // Table doesn't exist or no access
    }
  }
  
  console.log(`\n📊 Found ${existingTables.length} accessible tables:`, existingTables.join(', '));
  return existingTables;
}

async function main() {
  const tables = await listAllTables();
  console.log('\n');
  
  await checkUsersTable();
  await checkWorkspacesTable();
  await checkWorkspaceMembersTable();
  
  console.log('\n🎯 SCHEMA DISCOVERY COMPLETE');
  console.log('This shows what tables and columns actually exist in the database.');
}

main().catch(console.error);