#!/usr/bin/env node

/**
 * Password Reset Flow Test Script
 * Tests the complete password reset workflow
 */

const testEmail = process.argv[2] || 'test@example.com';
const siteUrl = process.env.SITE_URL || 'https://app.meet-sam.com';

console.log('🔐 Testing Password Reset Flow');
console.log('================================\n');

console.log(`📧 Test Email: ${testEmail}`);
console.log(`🌐 Site URL: ${siteUrl}\n`);

async function testPasswordReset() {
  try {
    // Step 1: Request password reset
    console.log('📤 Step 1: Requesting password reset...');
    const response = await fetch(`${siteUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: testEmail }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Reset request failed:', data);
      process.exit(1);
    }

    console.log('✅ Reset request sent successfully');
    console.log('📧 Response:', data.message);
    console.log('');

    // Step 2: Check what should happen next
    console.log('📋 Next Steps for Manual Testing:');
    console.log('================================');
    console.log('');
    console.log('1. ✉️  Check Email Inbox');
    console.log(`   → Look for email to: ${testEmail}`);
    console.log('   → Subject: "🔑 Reset Your SAM AI Password"');
    console.log('   → From: Sarah Powell or Sophia Caldwell');
    console.log('');
    console.log('2. 🔗 Click Reset Link');
    console.log(`   → Should redirect to: ${siteUrl}/reset-password`);
    console.log('   → URL will have tokens: #access_token=...&type=recovery');
    console.log('');
    console.log('3. ✏️  Enter New Password');
    console.log('   → Password must be at least 6 characters');
    console.log('   → Confirm password');
    console.log('   → Click "Update Password"');
    console.log('');
    console.log('4. ✅ Verify Success');
    console.log('   → Should see: "Password updated successfully!"');
    console.log('   → Auto-redirected to dashboard');
    console.log('   → User should be signed in');
    console.log('');

    // Step 3: Verify Supabase Configuration
    console.log('🔧 Supabase Configuration Check:');
    console.log('================================');
    console.log('');
    console.log('Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/auth/url-configuration');
    console.log('');
    console.log('Verify these settings:');
    console.log(`  ✓ Site URL: ${siteUrl}`);
    console.log('  ✓ Redirect URLs:');
    console.log(`     - ${siteUrl}/reset-password`);
    console.log(`     - ${siteUrl}/**`);
    console.log('     - http://localhost:3000/reset-password (for dev)');
    console.log('');

    // Step 4: Troubleshooting
    console.log('⚠️  If Link Says "Not Valid":');
    console.log('================================');
    console.log('');
    console.log('Common causes:');
    console.log('  1. ⏰ Link expired (24 hour limit)');
    console.log('     → Request a NEW reset');
    console.log('');
    console.log('  2. 🔗 Redirect URL not whitelisted in Supabase');
    console.log('     → Add the redirect URLs above');
    console.log('');
    console.log('  3. 🌐 Wrong site URL');
    console.log('     → Verify NEXT_PUBLIC_SITE_URL env variable');
    console.log('');
    console.log('  4. 🔄 Old link format');
    console.log('     → Must have #access_token in URL (NOT ?email=...)');
    console.log('');

    // Step 5: Check Postmark
    console.log('📬 Check Email Delivery:');
    console.log('================================');
    console.log('');
    if (testEmail.includes('3cubed') || testEmail.includes('cubedcapital')) {
      console.log('Provider: Postmark (3cubed server)');
      console.log('From: Sophia Caldwell <sophia@3cubed.ai>');
      console.log('API Key: 77cdd228-d19f-4e18-9373-a1bc8f4a4a22');
    } else {
      console.log('Provider: Postmark (InnovareAI server)');
      console.log('From: Sarah Powell <sp@innovareai.com>');
      console.log('API Key: bf9e070d-eec7-4c41-8fb5-1d37fe384723');
    }
    console.log('');
    console.log('Check Activity: https://account.postmarkapp.com');
    console.log('');

    console.log('✅ Password reset test initiated successfully!');
    console.log('');
    console.log('📝 Full testing guide: temp/test-password-reset.md');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPasswordReset();
