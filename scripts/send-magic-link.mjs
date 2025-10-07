#!/usr/bin/env node
/**
 * Send Magic Link to Any User
 * Usage: node scripts/send-magic-link.mjs <email> [domain]
 * 
 * If domain is not provided, uses app.meet-sam.com
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendMagicLink() {
  const email = process.argv[2];
  const domain = process.argv[3] || 'app.meet-sam.com';
  
  if (!email) {
    console.error('❌ Usage: node scripts/send-magic-link.mjs <email> [domain]');
    console.log('\nExamples:');
    console.log('  node scripts/send-magic-link.mjs jim.heim@sendingcell.com sendingcell.com');
    console.log('  node scripts/send-magic-link.mjs user@example.com app.meet-sam.com');
    process.exit(1);
  }

  console.log(`📧 Sending magic link to ${email}...`);
  console.log(`🌐 Redirect domain: ${domain}\n`);

  // Check if user exists
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email} (${user.id})\n`);

  // Generate magic link
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: email,
    options: {
      redirectTo: `https://${domain}/auth/callback`
    }
  });

  if (error) {
    console.error('❌ Failed to generate magic link:', error);
    process.exit(1);
  }

  const magicLink = data.properties.action_link;

  console.log('✅ Magic link generated!\n');
  console.log('═══════════════════════════════════════');
  console.log('🔗 Magic Link:');
  console.log(magicLink);
  console.log('═══════════════════════════════════════');
  console.log('\n⏰ Link expires in 1 hour');
  console.log('💡 Send this link securely to the user');
  console.log(`   Or call: POST https://${domain}/api/auth/magic-link`);
  console.log(`   Body: { "email": "${email}" }`);
}

sendMagicLink().catch(console.error);
