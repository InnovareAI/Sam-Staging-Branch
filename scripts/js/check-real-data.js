#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 CHECKING FOR ACTUAL DATA');
console.log('===========================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceCheckUsers() {
  console.log('👤 FORCE CHECKING USERS TABLE:');
  console.log('==============================');
  
  try {
    // Try different approaches to get users data
    console.log('🔄 Method 1: Standard select...');
    const { data: users1, error: error1 } = await supabase
      .from('users')
      .select('*');
    
    if (error1) {
      console.log('❌ Standard select error:', error1.message);
    } else {
      console.log(`✅ Standard select: ${users1.length} records`);
      if (users1.length > 0) {
        console.log('📄 Sample data:', users1[0]);
      }
    }
    
    console.log('\n🔄 Method 2: Select with count...');
    const { count, error: error2 } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error2) {
      console.log('❌ Count error:', error2.message);
    } else {
      console.log(`✅ Total count: ${count} records`);
    }
    
    console.log('\n🔄 Method 3: Try to get specific columns...');
    const { data: users3, error: error3 } = await supabase
      .from('users')
      .select('id, email, first_name, last_name');
    
    if (error3) {
      console.log('❌ Specific columns error:', error3.message);
    } else {
      console.log(`✅ Specific columns: ${users3.length} records`);
      users3.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.first_name || 'N/A'} ${user.last_name || ''} (${user.email || 'No email'})`);
        console.log(`      ID: ${user.id}`);
      });
    }
    
  } catch (err) {
    console.log('❌ Force check error:', err.message);
  }
}

async function checkAuthUsers() {
  console.log('\n🔐 CHECKING AUTH.USERS TABLE:');
  console.log('=============================');
  
  try {
    // Try to access auth schema
    const { data: authUsers, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('❌ Auth users error:', error.message);
    } else {
      console.log(`✅ Auth users found: ${authUsers.users.length}`);
      authUsers.users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (ID: ${user.id})`);
        console.log(`      Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log(`      Last sign in: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}`);
        if (user.user_metadata && Object.keys(user.user_metadata).length > 0) {
          console.log(`      Metadata:`, user.user_metadata);
        }
      });
    }
    
  } catch (err) {
    console.log('❌ Auth check error:', err.message);
  }
}

async function checkOrganizations() {
  console.log('\n🏢 CHECKING ORGANIZATIONS TABLE:');
  console.log('================================');
  
  try {
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*');
    
    if (error) {
      console.log('❌ Organizations error:', error.message);
    } else {
      console.log(`✅ Organizations found: ${orgs.length}`);
      orgs.forEach((org, index) => {
        console.log(`   ${index + 1}. ${org.name || 'Unnamed'} (ID: ${org.id})`);
        if (org.slug) console.log(`      Slug: ${org.slug}`);
        if (org.created_at) console.log(`      Created: ${new Date(org.created_at).toLocaleDateString()}`);
      });
    }
    
  } catch (err) {
    console.log('❌ Organizations check error:', err.message);
  }
}

async function tryDifferentApproach() {
  console.log('\n🔧 TRYING DIFFERENT DATA ACCESS APPROACH:');
  console.log('=========================================');
  
  try {
    // Try using service role to bypass RLS
    console.log('🔄 Using service role client...');
    
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const { data: rawUsers, error: rawError } = await serviceSupabase
      .from('users')
      .select('*');
    
    if (rawError) {
      console.log('❌ Service role error:', rawError.message);
    } else {
      console.log(`✅ Service role access: ${rawUsers.length} users`);
      rawUsers.forEach((user, index) => {
        console.log(`   ${index + 1}. Email: ${user.email || 'No email'}`);
        console.log(`      ID: ${user.id}`);
        if (user.clerk_id) console.log(`      Clerk ID: ${user.clerk_id}`);
        console.log(`      Name: ${user.first_name || 'N/A'} ${user.last_name || ''}`);
      });
    }
    
  } catch (err) {
    console.log('❌ Service role approach error:', err.message);
  }
}

async function main() {
  await forceCheckUsers();
  await checkAuthUsers();
  await checkOrganizations();
  await tryDifferentApproach();
  
  console.log('\n🎯 DATA CHECK COMPLETE');
  console.log('This should reveal what actual data exists in the database.');
}

main().catch(console.error);