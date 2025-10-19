const UNIPILE_API_KEY = 'aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=';
const UNIPILE_DSN = 'api6.unipile.com:13670';

// User's LinkedIn account IDs
const ACCOUNT_IDS = ['mERQmojtSZq5GeomZZazlw', 'aRT-LuSWTa-FmtSIE8p6aA'];

async function checkAccounts() {
  try {
    const accountUrl = `https://${UNIPILE_DSN}/api/v1/accounts`;

    console.log('🔍 Fetching all Unipile accounts...\n');

    const response = await fetch(accountUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status}`);
      return;
    }

    const data = await response.json();
    const accounts = Array.isArray(data) ? data : (data.items || []);

    console.log(`📊 Total accounts: ${accounts.length}\n`);

    // Filter for user's accounts
    const userAccounts = accounts.filter(a => ACCOUNT_IDS.includes(a.id));

    console.log(`👤 User's LinkedIn accounts: ${userAccounts.length}\n`);
    console.log('═══════════════════════════════════════════════════════════\n');

    for (const acc of userAccounts) {
      const features = acc.connection_params?.im?.premiumFeatures || [];
      const name = acc.connection_params?.im?.name || 'Unknown';
      const email = acc.connection_params?.im?.email || acc.connection_params?.im?.username || 'Unknown';

      // Check for Sales Nav with case-insensitive comparison
      const hasSalesNav = features.some(f =>
        f.toLowerCase() === 'sales_navigator' || f.toLowerCase() === 'recruiter'
      );

      console.log(`📧 Account: ${name}`);
      console.log(`   Email: ${email}`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Type: ${acc.type}`);
      console.log(`   Features: ${features.join(', ') || 'none'}`);
      console.log(`   Has Sales Nav: ${hasSalesNav ? '✅ YES' : '❌ NO'}`);

      if (hasSalesNav) {
        console.log(`   👉 THIS IS THE SALES NAV ACCOUNT`);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════\n');

    // Now test the saved search with each account
    const savedSearchUrl = 'https://www.linkedin.com/sales/search/people?savedSearchId=22040586';
    const searchUrl = `https://${UNIPILE_DSN}/api/v1/linkedin/search`;

    for (const acc of userAccounts) {
      console.log(`\n🔍 Testing saved search with account: ${acc.connection_params?.im?.name || acc.id}`);

      const params = new URLSearchParams({
        account_id: acc.id,
        limit: '10'
      });

      const payload = { url: savedSearchUrl };

      console.log(`   URL: ${searchUrl}?${params}`);
      console.log(`   Payload: ${JSON.stringify(payload)}`);

      const searchResponse = await fetch(`${searchUrl}?${params}`, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log(`   Response: ${searchResponse.status} ${searchResponse.statusText}`);

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.log(`   ❌ Error: ${errorText}`);
      } else {
        const result = await searchResponse.json();
        const count = result.items?.length || 0;
        console.log(`   ✅ Success! Retrieved ${count} prospects`);
        console.log(`   Has cursor: ${result.cursor ? 'Yes' : 'No'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkAccounts();
