#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

async function checkLinkedInAccounts() {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    console.error('❌ Missing Unipile credentials in .env.local');
    console.log('Need: UNIPILE_DSN and UNIPILE_API_KEY');
    return;
  }

  console.log('🔍 Checking LinkedIn accounts in Unipile...\n');

  try {
    const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Unipile API error:', response.status, response.statusText);
      return;
    }

    const data = await response.json();
    const accounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
    
    const linkedinAccounts = accounts.filter(acc => acc.type === 'LINKEDIN');
    
    console.log(`📊 Total accounts in Unipile: ${accounts.length}`);
    console.log(`🔗 LinkedIn accounts: ${linkedinAccounts.length}\n`);

    if (linkedinAccounts.length === 0) {
      console.log('⚠️  NO LINKEDIN ACCOUNTS CONNECTED!');
      console.log('\n💡 You need to:');
      console.log('   1. Go to https://app.meet-sam.com/linkedin-integration');
      console.log('   2. Click "Connect LinkedIn"');
      console.log('   3. Complete OAuth flow');
      console.log('   4. THEN proxies can be assigned\n');
      return;
    }

    linkedinAccounts.forEach((acc, i) => {
      console.log(`${i + 1}. ${acc.name}`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Status: ${acc.sources?.[0]?.status || 'Unknown'}`);
      console.log(`   Location: ${acc.connection_params?.im?.location || 'Not set'}`);
      console.log('');
    });

    console.log('✅ These accounts can now have proxies assigned!');
    console.log('\n🔧 Next step: Click "Regenerate All" in the Proxy Management modal');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkLinkedInAccounts();
