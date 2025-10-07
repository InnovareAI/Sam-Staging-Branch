#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetPassword() {
  const email = 'jim.heim@sendingcell.com';
  const tempPassword = 'SendingCell2025!';
  
  console.log('🔑 Resetting password for Jim Heim...\n');

  // Update user password using admin API
  const { data: users } = await supabase.auth.admin.listUsers();
  const jim = users.users.find(u => u.email === email);

  if (!jim) {
    console.error('❌ User not found');
    return;
  }

  console.log(`Found user: ${jim.email} (${jim.id})\n`);

  const { data, error } = await supabase.auth.admin.updateUserById(
    jim.id,
    { password: tempPassword }
  );

  if (error) {
    console.error('❌ Failed to reset password:', error);
  } else {
    console.log('✅ Password reset successfully!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Temporary Password:', tempPassword);
    console.log('\n⚠️  User should change this password after logging in');
  }
}

resetPassword().catch(console.error);
