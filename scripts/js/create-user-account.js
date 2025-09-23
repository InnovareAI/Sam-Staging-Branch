#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('👤 USER ACCOUNT CREATION READY');
console.log('==============================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUserAccount(email, password, firstName = '', lastName = '', organizationName = 'InnovareAI') {
  console.log(`🔧 Creating user account for ${email}...`);
  
  try {
    // Step 1: Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });
    
    if (authError) {
      console.log('❌ Error creating auth user:', authError.message);
      return null;
    }
    
    console.log('✅ Created auth user successfully');
    console.log(`   User ID: ${authUser.user.id}`);
    console.log(`   Email: ${authUser.user.email}`);
    
    // Step 2: Create user in public.users table
    const { data: publicUser, error: publicError } = await supabase
      .from('users')
      .insert([{
        id: authUser.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (publicError) {
      console.log('❌ Error creating public user:', publicError.message);
      // Clean up auth user if public user creation fails
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return null;
    }
    
    console.log('✅ Created public user record');
    
    // Step 3: Get organization ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', organizationName)
      .single();
    
    if (orgError) {
      console.log(`⚠️  Could not find organization ${organizationName}:`, orgError.message);
    } else {
      console.log(`✅ Found organization: ${organizationName} (${org.id})`);
    }
    
    return {
      authUser: authUser.user,
      publicUser: publicUser,
      organization: org
    };
    
  } catch (err) {
    console.log('❌ Exception creating user:', err.message);
    return null;
  }
}

async function verifyUserCreation(email) {
  console.log(`\n🔍 Verifying user creation for ${email}...`);
  
  try {
    // Check auth user
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.users.find(u => u.email === email);
    
    // Check public user
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);
    
    if (authUser && publicUsers.length > 0) {
      console.log('✅ User verification successful');
      console.log(`   Auth user exists: ${authUser.id}`);
      console.log(`   Public user exists: ${publicUsers[0].id}`);
      console.log(`   Email confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
      return true;
    } else {
      console.log('❌ User verification failed');
      return false;
    }
  } catch (err) {
    console.log('❌ Verification error:', err.message);
    return false;
  }
}

// This script is ready to create a user account
// Usage: provide email, password, and optional name/organization

console.log('📋 Ready to create user account');
console.log('Please provide:');
console.log('• Email address');
console.log('• Password');
console.log('• First name (optional)');
console.log('• Last name (optional)');
console.log('• Organization name (defaults to InnovareAI)');

// Export functions for use
export { createUserAccount, verifyUserCreation };