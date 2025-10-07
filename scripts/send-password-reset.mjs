#!/usr/bin/env node
/**
 * Send Password Reset Link to Any User
 * Usage: node scripts/send-password-reset.mjs <email> [domain]
 * 
 * If domain is not provided, uses app.meet-sam.com
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendPasswordReset() {
  const email = process.argv[2];
  const domain = process.argv[3] || 'app.meet-sam.com';
  
  if (!email) {
    console.error('❌ Usage: node scripts/send-password-reset.mjs <email> [domain]');
    console.log('\nExamples:');
    console.log('  node scripts/send-password-reset.mjs jim.heim@sendingcell.com sendingcell.com');
    console.log('  node scripts/send-password-reset.mjs user@example.com app.meet-sam.com');
    process.exit(1);
  }

  console.log(`🔑 Sending password reset to ${email}...`);
  console.log(`🌐 Redirect domain: ${domain}\n`);

  // Check if user exists
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email} (${user.id})\n`);

  // Generate password reset link
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: {
      redirectTo: `https://${domain}/reset-password`
    }
  });

  if (error) {
    console.error('❌ Failed to generate reset link:', error);
    process.exit(1);
  }

  const resetLink = data.properties.action_link;

  console.log('✅ Password reset link generated!\n');
  console.log('═══════════════════════════════════════');
  console.log('🔗 Reset Link:');
  console.log(resetLink);
  console.log('═══════════════════════════════════════');
  console.log('\n⏰ Link expires in 24 hours');
  console.log('💡 Send this link securely to the user');
  console.log(`   Or call: POST https://${domain}/api/auth/reset-password`);
  console.log(`   Body: { "email": "${email}" }`);
}

sendPasswordReset().catch(console.error);
