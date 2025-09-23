#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('👤 CREATING TL@INNOVAREAI.COM ACCOUNT');
console.log('====================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTLAccount() {
  const email = 'tl@innovareai.com';
  const password = 'INN-ABC-123';
  const firstName = 'TL';
  const lastName = '';
  
  console.log(`🔧 Creating account for ${email}...`);
  
  try {
    // Step 1: Create user in Supabase Auth
    console.log('📝 Step 1: Creating Supabase auth user...');
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
    
    console.log('✅ Created Supabase auth user successfully');
    console.log(`   User ID: ${authUser.user.id}`);
    console.log(`   Email: ${authUser.user.email}`);
    console.log(`   Email confirmed: ${authUser.user.email_confirmed_at ? 'Yes' : 'No'}`);
    
    // Step 2: Create user in public.users table
    console.log('\n📝 Step 2: Creating public user record...');
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
      console.log('🧹 Cleaning up auth user...');
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return null;
    }
    
    console.log('✅ Created public user record successfully');
    console.log(`   Public User ID: ${publicUser.id}`);
    console.log(`   Name: ${publicUser.first_name} ${publicUser.last_name}`);
    
    // Step 3: Get InnovareAI organization
    console.log('\n📝 Step 3: Finding InnovareAI organization...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('name', 'InnovareAI')
      .single();
    
    if (orgError) {
      console.log('❌ Could not find InnovareAI organization:', orgError.message);
    } else {
      console.log('✅ Found InnovareAI organization');
      console.log(`   Org ID: ${org.id}`);
      console.log(`   Org Name: ${org.name}`);
      console.log(`   Org Slug: ${org.slug}`);
    }
    
    return {
      authUser: authUser.user,
      publicUser: publicUser,
      organization: org
    };
    
  } catch (err) {
    console.log('❌ Exception creating account:', err.message);
    return null;
  }
}

async function verifyAccountCreation() {
  console.log('\n🔍 Verifying account creation...');
  
  try {
    // Check auth user
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.users.find(u => u.email === 'tl@innovareai.com');
    
    // Check public user
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'tl@innovareai.com');
    
    if (authUser && publicUsers.length > 0) {
      console.log('✅ Account verification successful');
      console.log(`   Auth user ID: ${authUser.id}`);
      console.log(`   Public user ID: ${publicUsers[0].id}`);
      console.log(`   Email: ${authUser.email}`);
      console.log(`   Created: ${new Date(authUser.created_at).toLocaleDateString()}`);
      return true;
    } else {
      console.log('❌ Account verification failed');
      console.log(`   Auth user found: ${authUser ? 'Yes' : 'No'}`);
      console.log(`   Public user found: ${publicUsers.length > 0 ? 'Yes' : 'No'}`);
      return false;
    }
  } catch (err) {
    console.log('❌ Verification error:', err.message);
    return false;
  }
}

async function showLoginInstructions() {
  console.log('\n🚀 LOGIN INSTRUCTIONS');
  console.log('=====================');
  console.log('Your account has been created! You can now log in with:');
  console.log('');
  console.log('📧 Email: tl@innovareai.com');
  console.log('🔑 Password: INN-ABC-123');
  console.log('🏢 Organization: InnovareAI (Admin)');
  console.log('');
  console.log('🌐 Login URL: https://app.meet-sam.com');
  console.log('');
  console.log('⚠️  Note: Since the database was reset, you may need to:');
  console.log('• Create a new workspace');
  console.log('• Set up integrations again');
  console.log('• Rebuild knowledge base content');
}

async function main() {
  const result = await createTLAccount();
  
  if (result) {
    const verified = await verifyAccountCreation();
    
    if (verified) {
      await showLoginInstructions();
      
      console.log('\n🎉 ACCOUNT CREATION SUCCESSFUL!');
      console.log('==============================');
      console.log('✅ tl@innovareai.com account is ready for use');
      console.log('✅ Password: INN-ABC-123');
      console.log('✅ Organization: InnovareAI (Admin)');
      console.log('✅ You can now log into the SAM AI platform');
    } else {
      console.log('\n❌ ACCOUNT CREATION FAILED');
      console.log('===========================');
      console.log('Account was created but verification failed');
    }
  } else {
    console.log('\n❌ ACCOUNT CREATION FAILED');
    console.log('===========================');
    console.log('Could not create tl@innovareai.com account');
  }
}

main().catch(console.error);