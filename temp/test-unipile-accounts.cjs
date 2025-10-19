const fetch = require('node-fetch');

const UNIPILE_API_KEY = 'aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU=';
const UNIPILE_DSN = 'api6';

const unipileUrl = `https://${UNIPILE_DSN}.unipile.com:13443/api/v1/accounts`;

async function testUnipileAccounts() {
  try {
    console.log(`🌐 Fetching accounts from: ${unipileUrl}`);

    const response = await fetch(unipileUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const data = await response.json();
    const accounts = Array.isArray(data) ? data : (data.items || []);

    console.log(`✅ Total accounts: ${accounts.length}`);

    // Filter for user's accounts
    const userAccounts = accounts.filter(a =>
      a.id === 'mERQmojtSZq5GeomZZazlw' || a.id === 'aRT-LuSWTa-FmtSIE8p6aA'
    );

    console.log(`\n📊 User's LinkedIn accounts: ${userAccounts.length}`);

    userAccounts.forEach(acc => {
      const features = acc.connection_params?.im?.premiumFeatures || [];
      const name = acc.connection_params?.im?.name || 'Unknown';
      const hasSalesNav = features.includes('SALES_NAVIGATOR') || features.includes('RECRUITER');

      console.log(`\n🔍 Account: ${name}`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Type: ${acc.type}`);
      console.log(`   Features: ${features.join(', ') || 'none'}`);
      console.log(`   Has Sales Nav: ${hasSalesNav ? '✅ YES' : '❌ NO'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testUnipileAccounts();
