/**
 * Check LinkedIn account connection status in Unipile
 * Run with: node scripts/check-unipile-linkedin.cjs
 */
require('dotenv').config({ path: '.env.local' });

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

async function checkLinkedInConnection() {
  try {
    console.log('🔍 Checking LinkedIn account connection in Unipile...\n');

    // Fetch all accounts
    const accountsResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!accountsResponse.ok) {
      console.error('❌ Failed to fetch accounts:', accountsResponse.status);
      return;
    }

    const accountsData = await accountsResponse.json();
    console.log(`✅ Found ${accountsData.items?.length || 0} total accounts\n`);

    // Find LinkedIn accounts
    const linkedinAccounts = accountsData.items?.filter(acc =>
      acc.type === 'LINKEDIN' || acc.provider === 'LINKEDIN'
    ) || [];

    if (linkedinAccounts.length === 0) {
      console.log('❌ No LinkedIn accounts connected to Unipile\n');
      console.log('📋 Next steps:');
      console.log('1. Go to your SAM AI dashboard');
      console.log('2. Navigate to Settings > Integrations');
      console.log('3. Click "Connect LinkedIn Account"');
      console.log('4. Complete the Unipile authentication flow');
      return;
    }

    console.log(`✅ Found ${linkedinAccounts.length} LinkedIn account(s):\n`);

    linkedinAccounts.forEach((account, index) => {
      console.log(`${index + 1}. ${account.name || 'Unnamed Account'}`);
      console.log(`   Account ID: ${account.id}`);
      console.log(`   Email: ${account.email || 'N/A'}`);
      console.log(`   Type: ${account.type}`);

      // Check source status
      if (account.sources && account.sources.length > 0) {
        const source = account.sources[0];
        console.log(`   Source ID: ${source.id}`);
        console.log(`   Status: ${source.status}`);

        if (source.status === 'OK') {
          console.log('   ✅ CONNECTED AND ACTIVE');
        } else {
          console.log(`   ⚠️  STATUS: ${source.status} (may need reconnection)`);
        }
      } else {
        console.log('   ⚠️  No sources found');
      }

      // Check premium features
      if (account.connection_params?.im?.premiumFeatures) {
        console.log(`   Premium Features: ${account.connection_params.im.premiumFeatures.join(', ')}`);
      }

      console.log('');
    });

    // Summary
    const activeAccounts = linkedinAccounts.filter(acc =>
      acc.sources?.[0]?.status === 'OK'
    );

    console.log('\n📊 Summary:');
    console.log(`   Total LinkedIn accounts: ${linkedinAccounts.length}`);
    console.log(`   Active accounts: ${activeAccounts.length}`);
    console.log(`   Inactive accounts: ${linkedinAccounts.length - activeAccounts.length}`);

    if (activeAccounts.length > 0) {
      console.log('\n🚀 You can start sending campaigns!');
      console.log('   Your LinkedIn account is connected and ready.');
    } else {
      console.log('\n⚠️  LinkedIn account needs reconnection');
      console.log('   Please reconnect in Settings > Integrations');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkLinkedInConnection();
