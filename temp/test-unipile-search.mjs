const UNIPILE_API_KEY = 'aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=';
const UNIPILE_DSN = 'api6.unipile.com:13670';

// User's Sales Navigator account IDs (both accounts)
const ACCOUNT_IDS = ['mERQmojtSZq5GeomZZazlw', 'aRT-LuSWTa-FmtSIE8p6aA'];

// Test saved search URL from user
const SAVED_SEARCH_URL = 'https://www.linkedin.com/sales/search/people?savedSearchId=22040586';

async function testUnipileSearch() {
  try {
    // First, check the account
    console.log('🔍 Step 1: Checking account details...');
    const accountUrl = UNIPILE_DSN.includes('.')
      ? `https://${UNIPILE_DSN}/api/v1/accounts`
      : `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/accounts`;
    const accountResponse = await fetch(accountUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!accountResponse.ok) {
      console.error(`❌ Account fetch failed: ${accountResponse.status} ${accountResponse.statusText}`);
      return;
    }

    const accountsData = await accountResponse.json();
    const accounts = Array.isArray(accountsData) ? accountsData : (accountsData.items || []);
    const userAccounts = accounts.filter(a => ACCOUNT_IDS.includes(a.id));

    if (userAccounts.length === 0) {
      console.error(`❌ No user accounts found`);
      return;
    }

    console.log(`✅ Found ${userAccounts.length} user account(s):\n`);

    let salesNavAccount = null;

    for (const acc of userAccounts) {
      const features = acc.connection_params?.im?.premiumFeatures || [];
      const name = acc.connection_params?.im?.name || 'Unknown';

      // Check for Sales Nav with both upper and lowercase
      const hasSalesNav = features.some(f =>
        f.toLowerCase() === 'sales_navigator' || f.toLowerCase() === 'recruiter'
      );

      console.log(`📊 Account: ${name}`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Features: ${features.join(', ') || 'none'}`);
      console.log(`   Has Sales Nav: ${hasSalesNav ? '✅ YES' : '❌ NO'}`);

      if (hasSalesNav && !salesNavAccount) {
        salesNavAccount = acc;
        console.log(`   👉 SELECTED for search`);
      }
      console.log('');
    }

    if (!salesNavAccount) {
      console.log('⚠️ No Sales Navigator account found, using first account');
      salesNavAccount = userAccounts[0];
    }

    // Now test the search
    console.log('🔍 Step 2: Testing saved search...');
    console.log(`Using account: ${salesNavAccount.id}`);
    const searchUrl = UNIPILE_DSN.includes('.')
      ? `https://${UNIPILE_DSN}/api/v1/linkedin/search`
      : `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/linkedin/search`;
    const params = new URLSearchParams({
      account_id: salesNavAccount.id,
      limit: '100'
    });

    const searchPayload = {
      url: SAVED_SEARCH_URL
    };

    console.log(`🌐 Calling: ${searchUrl}?${params}`);
    console.log(`📦 Payload:`, JSON.stringify(searchPayload, null, 2));

    const searchResponse = await fetch(`${searchUrl}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(searchPayload)
    });

    console.log(`📡 Response status: ${searchResponse.status} ${searchResponse.statusText}`);

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('❌ Search failed');
      console.error('Response body:', errorText);
      return;
    }

    const searchData = await searchResponse.json();
    const prospects = searchData.items || [];

    console.log(`✅ Search successful!`);
    console.log(`   Retrieved: ${prospects.length} prospects`);
    console.log(`   Has cursor: ${searchData.cursor ? 'Yes' : 'No'}`);

    if (prospects.length > 0) {
      console.log(`\n📊 First prospect:`);
      console.log(`   Name: ${prospects[0].name || prospects[0].first_name + ' ' + prospects[0].last_name}`);
      console.log(`   Title: ${prospects[0].headline || prospects[0].current_positions?.[0]?.role}`);
      console.log(`   Company: ${prospects[0].current_positions?.[0]?.company}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testUnipileSearch();
