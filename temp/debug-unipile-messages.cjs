const https = require('https');

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

// Thorsten's account
const THORSTEN_ACCOUNT_ID = '09Uv5wIaSFOiN2gVA2mHSQ';

async function debug() {
  console.log('🔍 Debugging Unipile API for Thorsten Linz...\n');
  console.log('API Key:', UNIPILE_API_KEY?.slice(0, 10) + '...');
  console.log('Account ID:', THORSTEN_ACCOUNT_ID);

  // 1. First check account status
  console.log('\n\n=== 1. Checking Account Status ===');
  await makeRequest(`/api/v1/accounts/${THORSTEN_ACCOUNT_ID}`);

  // 2. Get chats with full details
  console.log('\n\n=== 2. Getting Chats ===');
  await makeRequest(`/api/v1/chats?account_id=${THORSTEN_ACCOUNT_ID}&limit=5`);

  // 3. Get messages without account filter (see if any come through)
  console.log('\n\n=== 3. Getting Messages ===');
  await makeRequest(`/api/v1/messages?account_id=${THORSTEN_ACCOUNT_ID}&limit=20`);

  // 4. Try getting messages with a time filter
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  console.log('\n\n=== 4. Getting Messages Since Yesterday ===');
  await makeRequest(`/api/v1/messages?account_id=${THORSTEN_ACCOUNT_ID}&after=${yesterday.toISOString()}&limit=20`);
}

function makeRequest(path) {
  return new Promise((resolve) => {
    console.log(`\nGET ${path}`);

    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: path,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const result = JSON.parse(data);

          if (result.items) {
            console.log(`Items: ${result.items.length}`);
            if (result.items.length > 0) {
              console.log('First item:', JSON.stringify(result.items[0], null, 2).slice(0, 500));
            }
          } else if (result.id) {
            // Account response
            console.log('Account status:', result.status || result.connection_status);
            console.log('Provider:', result.provider);
          } else {
            console.log('Response:', JSON.stringify(result, null, 2).slice(0, 500));
          }
        } catch (e) {
          console.log('Raw response:', data.slice(0, 500));
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log('Error:', e.message);
      resolve();
    });
    req.end();
  });
}

debug();
