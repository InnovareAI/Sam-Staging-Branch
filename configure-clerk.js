// Configure Clerk settings via Backend API to disable organization setup
// Run with: node configure-clerk.js

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

if (!CLERK_SECRET_KEY) {
  console.error('❌ CLERK_SECRET_KEY environment variable is required');
  process.exit(1);
}

async function configureClerk() {
  const baseUrl = 'https://api.clerk.dev/v1';
  const headers = {
    'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
    'Content-Type': 'application/json'
  };

  try {
    console.log('🔧 Configuring Clerk settings...');

    // 1. Get current instance settings
    console.log('📋 Fetching current instance settings...');
    const instanceResponse = await fetch(`${baseUrl}/instance`, {
      method: 'GET',
      headers
    });

    if (!instanceResponse.ok) {
      throw new Error(`Failed to fetch instance: ${instanceResponse.status} ${instanceResponse.statusText}`);
    }

    const instance = await instanceResponse.json();
    console.log('✅ Current instance:', {
      allowPersonalAccounts: instance.allow_personal_accounts,
      organizationsEnabled: instance.organizations_enabled,
      restrictSignupMode: instance.restrict_to_same_email_domain
    });

    // 2. Update instance settings to allow personal accounts
    console.log('⚙️ Updating instance settings...');
    const updateResponse = await fetch(`${baseUrl}/instance`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        allow_personal_accounts: true,
        organizations_enabled: false, // Disable organizations entirely
        restrict_to_same_email_domain: false
      })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update instance: ${updateResponse.status} ${error}`);
    }

    const updatedInstance = await updateResponse.json();
    console.log('✅ Updated instance settings:', {
      allowPersonalAccounts: updatedInstance.allow_personal_accounts,
      organizationsEnabled: updatedInstance.organizations_enabled
    });

    // 3. Configure sign-up/sign-in restrictions
    console.log('🔓 Configuring authentication restrictions...');
    const restrictionsResponse = await fetch(`${baseUrl}/instance/restrictions`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        allowlist: false,
        blocklist: false,
        block_email_subaddresses: false,
        block_disposable_email_domains: false,
        ignore_dots_for_gmail_addresses: true
      })
    });

    if (restrictionsResponse.ok) {
      console.log('✅ Authentication restrictions configured');
    } else {
      console.log('⚠️ Could not configure restrictions (may not be available)');
    }

    console.log('\n🎉 Clerk configuration completed successfully!');
    console.log('📝 Settings applied:');
    console.log('  ✅ Personal accounts: ENABLED');
    console.log('  ❌ Organizations: DISABLED');
    console.log('  🔓 Sign-up mode: PUBLIC');
    console.log('\n🔄 Changes should take effect immediately.');
    console.log('🌐 Test at: https://app.meet-sam.com');

  } catch (error) {
    console.error('❌ Error configuring Clerk:', error.message);
    process.exit(1);
  }
}

configureClerk();