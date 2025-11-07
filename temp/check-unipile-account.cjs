const fetch = require('node-fetch');

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

async function checkUnipileAccount() {
  const accountId = 'mERQmojtSZq5GeomZZazlw';

  console.log('🔍 Checking Unipile account...\n');
  console.log(`Account ID: ${accountId}`);
  console.log(`DSN: https://${UNIPILE_DSN}\n`);

  try {
    // Get account details
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts/${accountId}`, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY
      }
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Account Details:');
      console.log(JSON.stringify(data, null, 2));

      // Check if account is active
      if (data.is_active === false) {
        console.log('\n❌ WARNING: Account is NOT active!');
        console.log('You need to reconnect this LinkedIn account in Unipile.');
      } else {
        console.log('\n✅ Account is active');
      }

      // Check provider info
      if (data.provider) {
        console.log(`\nProvider: ${data.provider}`);
        console.log(`Email: ${data.email || 'N/A'}`);
        console.log(`Name: ${data.display_name || 'N/A'}`);
      }
    } else {
      console.log('❌ Error fetching account:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

checkUnipileAccount().catch(console.error);
