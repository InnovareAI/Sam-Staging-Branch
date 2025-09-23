#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('👥 IDENTIFYING MISSING USERS');
console.log('============================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCurrentUsers() {
  console.log('📋 Current users in database:');
  
  try {
    // Check public.users table
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('*');
    
    if (publicError) {
      console.log('❌ Error checking public.users:', publicError.message);
    } else {
      console.log(`✅ Public users table: ${publicUsers.length} users`);
    }
    
    // Check auth.users via admin API
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log('❌ Error checking auth.users:', authError.message);
    } else {
      console.log(`✅ Auth users: ${authData.users.length} users`);
    }
    
    return { publicUsers: publicUsers || [], authUsers: authData?.users || [] };
  } catch (err) {
    console.log('❌ Error checking users:', err.message);
    return { publicUsers: [], authUsers: [] };
  }
}

async function identifyExpectedUsers() {
  console.log('\n🔍 Expected users based on earlier session data:');
  console.log('================================================');
  
  const expectedUsers = [
    {
      email: 'mg@innovareai.com',
      name: 'Mich',
      organization: 'InnovareAI',
      role: 'User',
      previousId: '6d9f6673-3d41-4f7b-96cd-93195de77e7d'
    },
    {
      email: 'cl@innovareai.com', 
      name: 'Unknown',
      organization: 'InnovareAI',
      role: 'User',
      previousId: '2cd530f9-9339-45f2-aaab-50be55a34a15'
    },
    {
      email: 'cs@innovareai.com',
      name: 'Unknown', 
      organization: 'InnovareAI',
      role: 'User',
      previousId: '31494078-265f-45e7-80d8-3599c9a75a96'
    }
  ];
  
  console.log('👤 Users that were deleted and need restoration:');
  expectedUsers.forEach((user, index) => {
    console.log(`\n   ${index + 1}. ${user.email}`);
    console.log(`      Name: ${user.name}`);
    console.log(`      Organization: ${user.organization}`);
    console.log(`      Role: ${user.role}`);
    console.log(`      Previous ID: ${user.previousId}`);
  });
  
  return expectedUsers;
}

async function checkOrganizationAssignments() {
  console.log('\n🏢 Organization assignments needed:');
  console.log('==================================');
  
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name');
    
    if (error) {
      console.log('❌ Error fetching organizations:', error.message);
      return;
    }
    
    console.log('Available organizations for user assignment:');
    orgs.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name} (ID: ${org.id})`);
    });
    
    console.log('\n📋 Suggested user-organization assignments:');
    console.log('==========================================');
    console.log('• mg@innovareai.com → InnovareAI (Admin role?)');
    console.log('• cl@innovareai.com → InnovareAI');  
    console.log('• cs@innovareai.com → InnovareAI');
    console.log('• Additional users for Sendingcell?');
    console.log('• Additional users for 3cubed?');
    console.log('• Additional users for WT Matchmaker?');
    
  } catch (err) {
    console.log('❌ Error checking organizations:', err.message);
  }
}

async function suggestUserRestoration() {
  console.log('\n🚀 User restoration plan:');
  console.log('=========================');
  
  console.log('1. Create users in Supabase auth system');
  console.log('2. Set up proper email/password authentication');
  console.log('3. Assign users to appropriate organizations');
  console.log('4. Set up admin privileges where needed');
  console.log('5. Create workspaces and workspace memberships');
  
  console.log('\n❓ Questions to clarify:');
  console.log('========================');
  console.log('• Who are the users for each organization?');
  console.log('• Which users should have admin privileges?');
  console.log('• What are the passwords for the restored users?');
  console.log('• Are there additional users beyond the 3 InnovareAI users?');
}

async function main() {
  const currentUsers = await checkCurrentUsers();
  const expectedUsers = await identifyExpectedUsers();
  await checkOrganizationAssignments();
  await suggestUserRestoration();
  
  console.log('\n🎯 SUMMARY:');
  console.log('===========');
  console.log(`Current users in database: ${currentUsers.publicUsers.length + currentUsers.authUsers.length}`);
  console.log(`Expected users to restore: ${expectedUsers.length}`);
  console.log('Organizations ready: 4 (Sendingcell, 3cubed, InnovareAI, WT Matchmaker)');
  console.log('\n📝 Please provide the complete list of users for each organization.');
}

main().catch(console.error);