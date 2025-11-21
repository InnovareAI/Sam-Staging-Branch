#!/usr/bin/env node
/**
 * Setup user for IA7 workspace with password
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7
const EMAIL = 'tbslinz@icloud.com';
const PASSWORD = 'TempPass123!'; // Temporary password

console.log('🔐 SETTING UP USER FOR IA7 WORKSPACE...\n');

// 1. Check if user exists
const { data: existingUsers } = await supabase.auth.admin.listUsers();
const existingUser = existingUsers.users.find(u => u.email === EMAIL);

let userId;

if (existingUser) {
  console.log('👤 User already exists:', EMAIL);
  console.log('   User ID:', existingUser.id);
  userId = existingUser.id;

  // Update password
  console.log('\n🔑 Updating password...');
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    userId,
    { password: PASSWORD }
  );

  if (updateError) {
    console.error('❌ Error updating password:', updateError.message);
    process.exit(1);
  }

  console.log('✅ Password updated');
} else {
  console.log('➕ Creating new user:', EMAIL);

  // Create user
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true
  });

  if (createError) {
    console.error('❌ Error creating user:', createError.message);
    process.exit(1);
  }

  console.log('✅ User created');
  console.log('   User ID:', newUser.user.id);
  userId = newUser.user.id;
}

// 2. Check if user is member of workspace
const { data: existingMember } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('user_id', userId)
  .single();

if (!existingMember) {
  console.log('\n👥 Adding user to workspace...');

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: WORKSPACE_ID,
      user_id: userId,
      role: 'admin'
    });

  if (memberError) {
    console.error('❌ Error adding to workspace:', memberError.message);
    process.exit(1);
  }

  console.log('✅ User added to workspace as admin');
} else {
  console.log('\n✅ User already member of workspace');
  console.log('   Role:', existingMember.role);
}

console.log('\n📋 LOGIN CREDENTIALS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('URL:      https://app.meet-sam.com');
console.log('Email:    ' + EMAIL);
console.log('Password: ' + PASSWORD);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n💡 After login, you will be redirected to IA7 workspace');
console.log('   Change password in settings after first login');
