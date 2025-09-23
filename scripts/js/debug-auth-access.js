#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🐛 DEBUGGING AUTH ACCESS ISSUE');
console.log('==============================\n');

console.log('🔧 Environment Check:');
console.log(`Supabase URL: ${supabaseUrl}`);
console.log(`Service Key: ${supabaseServiceKey ? supabaseServiceKey.substring(0, 30) + '...' : 'MISSING'}`);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDifferentAuthMethods() {
  console.log('\n🔍 Testing Different Auth Access Methods...');
  
  // Method 1: Admin list users
  console.log('\n📋 Method 1: Admin List Users');
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.log('❌ Admin list error:', error.message);
      console.log('   Error details:', error);
    } else {
      console.log(`✅ Admin list: ${data.users.length} users`);
      data.users.forEach((user, i) => {
        console.log(`   ${i+1}. ${user.email} (${user.id})`);
      });
    }
  } catch (err) {
    console.log('❌ Admin list exception:', err.message);
  }

  // Method 2: Admin list with pagination
  console.log('\n📋 Method 2: Admin List with Pagination');
  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 100
    });
    if (error) {
      console.log('❌ Paginated list error:', error.message);
    } else {
      console.log(`✅ Paginated list: ${data.users.length} users`);
    }
  } catch (err) {
    console.log('❌ Paginated list exception:', err.message);
  }

  // Method 3: Try to get user by ID (if we know one)
  console.log('\n📋 Method 3: Get User by Known ID');
  const knownIds = [
    '6d9f6673-3d41-4f7b-96cd-93195de77e7d',
    '2cd530f9-9339-45f2-aaab-50be55a34a15',
    '31494078-265f-45e7-80d8-3599c9a75a96'
  ];
  
  for (const userId of knownIds) {
    try {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) {
        console.log(`❌ Get user ${userId.substring(0, 8)}... error:`, error.message);
      } else {
        console.log(`✅ Found user: ${data.user.email} (${data.user.id})`);
      }
    } catch (err) {
      console.log(`❌ Get user ${userId.substring(0, 8)}... exception:`, err.message);
    }
  }
}

async function checkUsersTableDirectly() {
  console.log('\n👤 Direct Users Table Check...');
  
  try {
    // Force check with different select patterns
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, clerk_id, created_at')
      .limit(10);
    
    if (error) {
      console.log('❌ Users table error:', error.message);
    } else {
      console.log(`✅ Users table: ${users.length} records`);
      users.forEach((user, i) => {
        console.log(`   ${i+1}. ${user.email || 'No email'}`);
        console.log(`      ID: ${user.id}`);
        if (user.clerk_id) console.log(`      Clerk ID: ${user.clerk_id}`);
        console.log(`      Name: ${user.first_name || 'N/A'} ${user.last_name || ''}`);
      });
    }
  } catch (err) {
    console.log('❌ Users table exception:', err.message);
  }
}

async function testRawSQLAccess() {
  console.log('\n🔧 Testing Raw SQL Access...');
  
  try {
    // Try to use a custom function to access auth.users
    const { data, error } = await supabase.rpc('get_auth_users_count');
    if (error) {
      console.log('❌ Custom function error:', error.message);
    } else {
      console.log('✅ Custom function result:', data);
    }
  } catch (err) {
    console.log('❌ Custom function exception:', err.message);
  }
}

async function checkServiceRolePermissions() {
  console.log('\n🔑 Checking Service Role Permissions...');
  
  try {
    // Test basic table access
    const { data, error } = await supabase
      .from('users')
      .select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Count query error:', error.message);
    } else {
      console.log(`✅ Users count: ${data}`);
    }
  } catch (err) {
    console.log('❌ Count query exception:', err.message);
  }
}

async function tryAuthWithDifferentClient() {
  console.log('\n🔄 Trying Different Client Configuration...');
  
  const altSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`
      }
    }
  });
  
  try {
    const { data, error } = await altSupabase.auth.admin.listUsers();
    if (error) {
      console.log('❌ Alt client error:', error.message);
    } else {
      console.log(`✅ Alt client: ${data.users.length} users`);
      data.users.forEach((user, i) => {
        console.log(`   ${i+1}. ${user.email} (${user.id})`);
      });
    }
  } catch (err) {
    console.log('❌ Alt client exception:', err.message);
  }
}

async function main() {
  await testDifferentAuthMethods();
  await checkUsersTableDirectly();
  await testRawSQLAccess();
  await checkServiceRolePermissions();
  await tryAuthWithDifferentClient();
  
  console.log('\n🎯 DEBUG SUMMARY:');
  console.log('This should help identify why auth users are not showing up.');
}

main().catch(console.error);