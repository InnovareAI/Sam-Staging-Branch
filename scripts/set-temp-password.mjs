#!/usr/bin/env node
/**
 * Set Temporary Password for Any User
 * Usage: node scripts/set-temp-password.mjs <email> [password]
 * 
 * If password is not provided, generates a secure random one
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generatePassword() {
  // Generate a secure random password: Capital + lowercase + numbers + special
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]; // Capital
  password += 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 24)]; // Lowercase
  password += '23456789'[Math.floor(Math.random() * 8)]; // Number
  password += '!@#$%'[Math.floor(Math.random() * 5)]; // Special
  
  // Fill rest randomly
  for (let i = 0; i < 8; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function setTempPassword() {
  const email = process.argv[2];
  const customPassword = process.argv[3];
  
  if (!email) {
    console.error('❌ Usage: node scripts/set-temp-password.mjs <email> [password]');
    console.log('\nExamples:');
    console.log('  node scripts/set-temp-password.mjs jim.heim@sendingcell.com');
    console.log('  node scripts/set-temp-password.mjs user@example.com MyPassword123!');
    process.exit(1);
  }

  const tempPassword = customPassword || generatePassword();
  
  console.log(`🔑 Setting temporary password for ${email}...\n`);

  // Find user
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    console.log('\n💡 Available users:');
    users.users.slice(0, 10).forEach(u => {
      console.log(`   - ${u.email}`);
    });
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email} (${user.id})\n`);

  // Update password
  const { error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: tempPassword }
  );

  if (error) {
    console.error('❌ Failed to set password:', error);
    process.exit(1);
  }

  console.log('✅ Password set successfully!\n');
  console.log('═══════════════════════════════════════');
  console.log('📧 Email:', email);
  console.log('🔑 Password:', tempPassword);
  console.log('═══════════════════════════════════════');
  console.log('\n⚠️  IMPORTANT: User should change this password after first login');
  console.log('\n💡 Send these credentials securely to the user');
}

setTempPassword().catch(console.error);
