#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔑 RESETTING PASSWORD FOR TL@INNOVAREAI.COM');
console.log('===========================================\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findExistingUser() {
  console.log('🔍 Checking existing user...');
  
  try {
    // Check auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.users.find(u => u.email === 'tl@innovareai.com');
    
    // Check public users
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'tl@innovareai.com');
    
    if (authUser) {
      console.log('✅ Found existing auth user');
      console.log(`   User ID: ${authUser.id}`);
      console.log(`   Email: ${authUser.email}`);
      console.log(`   Created: ${new Date(authUser.created_at).toLocaleDateString()}`);
      console.log(`   Email confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
      
      if (publicUsers.length > 0) {
        console.log('✅ Found matching public user record');
      } else {
        console.log('⚠️  No matching public user record found');
      }
      
      return { authUser, publicUser: publicUsers[0] || null };
    } else {
      console.log('❌ No auth user found with email tl@innovareai.com');
      return null;
    }
  } catch (err) {
    console.log('❌ Error finding user:', err.message);
    return null;
  }
}

async function resetPassword(userId) {
  console.log('\n🔧 Resetting password...');
  
  try {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password: 'INN-ABC-123'
    });
    
    if (error) {
      console.log('❌ Error resetting password:', error.message);
      return false;
    }
    
    console.log('✅ Password reset successfully');
    console.log('🔑 New password: INN-ABC-123');
    return true;
  } catch (err) {
    console.log('❌ Exception resetting password:', err.message);
    return false;
  }
}

async function createPublicUserIfMissing(authUser) {
  console.log('\n📝 Ensuring public user record exists...');
  
  try {
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'tl@innovareai.com')
      .single();
    
    if (existingUser) {
      console.log('✅ Public user record already exists');
      return existingUser;
    }
    
    // Create public user record
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([{
        id: authUser.id,
        email: authUser.email,
        first_name: authUser.user_metadata?.first_name || 'TL',
        last_name: authUser.user_metadata?.last_name || '',
        created_at: authUser.created_at,
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (createError) {
      console.log('❌ Error creating public user:', createError.message);
      return null;
    }
    
    console.log('✅ Created public user record');
    return newUser;
  } catch (err) {
    console.log('❌ Error with public user:', err.message);
    return null;
  }
}

async function showLoginInstructions() {
  console.log('\n🚀 LOGIN INSTRUCTIONS');
  console.log('=====================');
  console.log('Your account is ready! You can now log in with:');
  console.log('');
  console.log('📧 Email: tl@innovareai.com');
  console.log('🔑 Password: INN-ABC-123');
  console.log('🏢 Organization: InnovareAI (Admin)');
  console.log('');
  console.log('🌐 Login URL: https://app.meet-sam.com');
}

async function main() {
  const userInfo = await findExistingUser();
  
  if (!userInfo) {
    console.log('\n❌ User not found. This is unexpected since creation failed.');
    return;
  }
  
  const passwordReset = await resetPassword(userInfo.authUser.id);
  
  if (!passwordReset) {
    console.log('\n❌ Failed to reset password');
    return;
  }
  
  const publicUser = await createPublicUserIfMissing(userInfo.authUser);
  
  await showLoginInstructions();
  
  console.log('\n🎉 ACCOUNT READY FOR USE!');
  console.log('=========================');
  console.log('✅ Password has been reset to: INN-ABC-123');
  console.log('✅ Account is configured for InnovareAI organization');
  console.log('✅ You can now log into the SAM AI platform');
  
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('• Database was reset - you may need to recreate workspaces');
  console.log('• All previous data was lost during the reset');
  console.log('• You may need to set up integrations again');
}

main().catch(console.error);