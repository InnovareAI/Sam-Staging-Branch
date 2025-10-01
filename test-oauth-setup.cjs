#!/usr/bin/env node
/**
 * Test OAuth Configuration for Email Providers
 * Checks if environment variables are properly configured
 */

console.log('\n🔍 Checking OAuth Configuration...\n');

// Check Google OAuth
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI;

console.log('📧 Google OAuth Configuration:');
console.log('  GOOGLE_CLIENT_ID:', googleClientId ? '✅ Set' : '❌ Missing');
console.log('  GOOGLE_CLIENT_SECRET:', googleClientSecret ? '✅ Set' : '❌ Missing');
console.log('  GOOGLE_REDIRECT_URI:', googleRedirectUri || '❌ Missing');

// Check Microsoft OAuth
const microsoftClientId = process.env.MICROSOFT_CLIENT_ID;
const microsoftClientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const microsoftRedirectUri = process.env.MICROSOFT_REDIRECT_URI;

console.log('\n📧 Microsoft OAuth Configuration:');
console.log('  MICROSOFT_CLIENT_ID:', microsoftClientId ? '✅ Set' : '❌ Missing');
console.log('  MICROSOFT_CLIENT_SECRET:', microsoftClientSecret ? '✅ Set' : '❌ Missing');
console.log('  MICROSOFT_REDIRECT_URI:', microsoftRedirectUri || '❌ Missing');

console.log('\n' + '='.repeat(60));

if (!googleClientId || !googleClientSecret || !googleRedirectUri) {
  console.log('\n⚠️  Google OAuth is NOT configured');
  console.log('\n📝 To set up Google OAuth:\n');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Create/select a project');
  console.log('3. Enable Gmail API');
  console.log('4. Create OAuth 2.0 credentials');
  console.log('5. Add to your .env.local:');
  console.log('   GOOGLE_CLIENT_ID=your_client_id');
  console.log('   GOOGLE_CLIENT_SECRET=your_client_secret');
  console.log('   GOOGLE_REDIRECT_URI=http://localhost:3003/api/email-providers/google/callback');
}

if (!microsoftClientId || !microsoftClientSecret || !microsoftRedirectUri) {
  console.log('\n⚠️  Microsoft OAuth is NOT configured');
  console.log('\n📝 To set up Microsoft OAuth:\n');
  console.log('1. Go to https://portal.azure.com/');
  console.log('2. Navigate to Azure Active Directory → App registrations');
  console.log('3. Create new app registration');
  console.log('4. Add redirect URI and create client secret');
  console.log('5. Add to your .env.local:');
  console.log('   MICROSOFT_CLIENT_ID=your_client_id');
  console.log('   MICROSOFT_CLIENT_SECRET=your_client_secret');
  console.log('   MICROSOFT_REDIRECT_URI=http://localhost:3003/api/email-providers/microsoft/callback');
}

if (googleClientId && googleClientSecret && googleRedirectUri &&
    microsoftClientId && microsoftClientSecret && microsoftRedirectUri) {
  console.log('\n✅ All OAuth credentials are configured!');
  console.log('\n🎉 You can now connect Google and Microsoft accounts');
  console.log('   Click the buttons in the Email Integration modal to start OAuth flow');
}

console.log('\n' + '='.repeat(60) + '\n');
