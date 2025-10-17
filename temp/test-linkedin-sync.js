// Test LinkedIn Connection Sync
// Run with: node temp/test-linkedin-sync.js

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

async function testConnectionFetch() {
  console.log('🔍 Testing Unipile LinkedIn Connection Fetch...\n');

  try {
    // Step 1: Get all Unipile accounts
    console.log('📡 Fetching Unipile accounts...');
    const accountsResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!accountsResponse.ok) {
      throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`);
    }

    const accountsData = await accountsResponse.json();
    console.log(`✅ Found ${accountsData.items?.length || 0} Unipile accounts\n`);

    // Show all providers
    console.log('📋 Available accounts:');
    accountsData.items?.forEach((acc, i) => {
      console.log(`${i + 1}. ${acc.name || 'Unnamed'} - Provider: ${acc.provider} (ID: ${acc.id})`);
    });
    console.log('');

    // Find LinkedIn account (try multiple provider names)
    const linkedinAccount = accountsData.items?.find(acc =>
      acc.provider?.toUpperCase() === 'LINKEDIN' ||
      acc.provider?.toUpperCase() === 'LINKED_IN' ||
      acc.type?.toUpperCase() === 'LINKEDIN'
    );

    if (!linkedinAccount) {
      console.error('❌ No LinkedIn account found in Unipile');
      console.log('   Looking for provider === "LINKEDIN" or "LINKED_IN"');
      return;
    }

    console.log(`🔗 LinkedIn Account Found:`);
    console.log(`   ID: ${linkedinAccount.id}`);
    console.log(`   Name: ${linkedinAccount.name || 'N/A'}`);
    console.log(`   Status: ${linkedinAccount.status || 'N/A'}\n`);

    // Step 2: Fetch connections for this LinkedIn account
    console.log('📡 Fetching LinkedIn connections...');
    const connectionsResponse = await fetch(
      `${UNIPILE_BASE_URL}/api/v1/accounts/${linkedinAccount.id}/connections?limit=500`,
      {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!connectionsResponse.ok) {
      throw new Error(`Failed to fetch connections: ${connectionsResponse.status}`);
    }

    const connectionsData = await connectionsResponse.json();
    const connections = connectionsData.items || [];

    console.log(`✅ Found ${connections.length} LinkedIn connections\n`);

    if (connections.length > 0) {
      console.log('📋 Sample connections (first 5):');
      connections.slice(0, 5).forEach((conn, i) => {
        console.log(`\n${i + 1}. ${conn.name || conn.full_name || 'Unknown'}`);
        console.log(`   Profile URL: ${conn.profile_url || conn.public_profile_url || 'N/A'}`);
        console.log(`   Internal ID: ${conn.id || conn.linkedin_id || 'N/A'}`);
        console.log(`   Company: ${conn.company || conn.company_name || 'N/A'}`);
      });

      console.log(`\n\n✅ Connection sync would store ${connections.length} connections`);
      console.log(`📝 Each connection would be stored in 'linkedin_contacts' table`);
    } else {
      console.log('⚠️ No connections returned from Unipile API');
      console.log('   This could mean:');
      console.log('   1. LinkedIn account has no connections');
      console.log('   2. Unipile sync is pending');
      console.log('   3. API permissions issue');
    }

  } catch (error) {
    console.error('❌ Error testing connection fetch:', error.message);
  }
}

testConnectionFetch();
