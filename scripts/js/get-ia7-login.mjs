#!/usr/bin/env node
/**
 * Get IA7 workspace owner email and generate magic link
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7
const OWNER_ID = 'f6885ff3-deef-4781-8721-93011c990b1b';

console.log('🔐 GETTING IA7 WORKSPACE LOGIN INFO...\n');

// 1. Get owner email from auth.users
const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(OWNER_ID);

if (authError) {
  console.error('❌ Error getting user:', authError.message);
  process.exit(1);
}

console.log('📧 Owner Email:', authUser.user.email);
console.log('👤 User ID:', authUser.user.id);

// 2. Generate magic link
console.log('\n🔗 Generating magic link...');

const { data: magicLink, error: linkError } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: authUser.user.email,
  options: {
    redirectTo: 'https://app.meet-sam.com/workspace/85e80099-12f9-491a-a0a1-ad48d086a9f0'
  }
});

if (linkError) {
  console.error('❌ Error generating link:', linkError.message);

  // Alternative: Send password reset email
  console.log('\n📨 Sending password reset email instead...');

  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    authUser.user.email,
    {
      redirectTo: 'https://app.meet-sam.com/workspace/85e80099-12f9-491a-a0a1-ad48d086a9f0'
    }
  );

  if (resetError) {
    console.error('❌ Error sending reset email:', resetError.message);
  } else {
    console.log(`✅ Password reset email sent to: ${authUser.user.email}`);
    console.log('   Check inbox and click the link to set a new password');
  }
} else {
  console.log('\n✅ Magic Link Generated:');
  console.log(magicLink.properties.action_link);
  console.log('\n📋 Use this link to log in directly (expires in 1 hour)');
}
