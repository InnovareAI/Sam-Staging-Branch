#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔐 DIRECT AUTH DATABASE CHECK');
console.log('=============================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAuthDatabase() {
  console.log('🔍 Checking Supabase Auth Database...');
  
  try {
    // Use admin API to list users
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 10
    });
    
    if (error) {
      console.log('❌ Error accessing auth users:', error.message);
      return;
    }
    
    console.log(`✅ Found ${users.length} authenticated users in auth.users:`);
    
    if (users.length === 0) {
      console.log('📝 No users found in auth database');
      console.log('This means the Supabase auth system has no registered users');
    } else {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. User ID: ${user.id}`);
        console.log(`   Email: ${user.email || 'No email'}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log(`   Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log(`   Last sign in: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}`);
        
        if (user.user_metadata && Object.keys(user.user_metadata).length > 0) {
          console.log(`   User metadata:`, user.user_metadata);
        }
        
        if (user.app_metadata && Object.keys(user.app_metadata).length > 0) {
          console.log(`   App metadata:`, user.app_metadata);
        }
        
        console.log(`   Role: ${user.role || 'authenticated'}`);
        console.log(`   Provider: ${user.app_metadata?.provider || 'email'}`);
      });
    }
    
  } catch (err) {
    console.log('❌ Error checking auth:', err.message);
  }
}

async function checkDatabaseTables() {
  console.log('\n📋 Available Tables Check:');
  console.log('==========================');
  
  // List of tables we know might exist
  const possibleTables = [
    'users', 'workspaces', 'workspace_members', 'organizations',
    'sam_conversation_threads', 'sam_conversation_messages', 'knowledge_base'
  ];
  
  for (const tableName of possibleTables) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${tableName}: ${error.message}`);
      } else {
        console.log(`✅ ${tableName}: Table exists`);
      }
    } catch (err) {
      console.log(`❌ ${tableName}: ${err.message}`);
    }
  }
}

async function checkSAMConversations() {
  console.log('\n💬 Checking SAM Conversations:');
  console.log('==============================');
  
  try {
    const { data: threads, error: threadsError } = await supabase
      .from('sam_conversation_threads')
      .select('*')
      .limit(5);
    
    if (threadsError) {
      console.log('❌ Conversation threads error:', threadsError.message);
    } else {
      console.log(`✅ Found ${threads.length} conversation threads`);
      threads.forEach((thread, index) => {
        console.log(`   ${index + 1}. ${thread.title || 'Untitled'} (ID: ${thread.id})`);
        console.log(`      User: ${thread.user_id}`);
        console.log(`      Created: ${new Date(thread.created_at).toLocaleDateString()}`);
      });
    }
    
    const { data: messages, error: messagesError } = await supabase
      .from('sam_conversation_messages')
      .select('*')
      .limit(5);
    
    if (messagesError) {
      console.log('❌ Messages error:', messagesError.message);
    } else {
      console.log(`✅ Found ${messages.length} messages`);
    }
    
  } catch (err) {
    console.log('❌ SAM conversations check error:', err.message);
  }
}

async function main() {
  await checkAuthDatabase();
  await checkDatabaseTables();
  await checkSAMConversations();
  
  console.log('\n🎯 SUMMARY:');
  console.log('===========');
  console.log('This check reveals the actual state of the Supabase database');
  console.log('and whether there are any users or data in the system.');
}

main().catch(console.error);