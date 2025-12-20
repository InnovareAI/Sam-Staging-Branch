const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('🔍 Checking ALL LinkedIn account connection status...\n');

  // Get all LinkedIn accounts from user_unipile_accounts
  const { data: accounts, error } = await supabase
    .from('user_unipile_accounts')
    .select('id, unipile_account_id, account_name, platform, connection_status')
    .eq('platform', 'LINKEDIN');

  if (error) {
    console.log('Error fetching accounts:', error.message);
    return;
  }

  console.log(`Found ${accounts?.length || 0} LinkedIn accounts in database:\n`);

  for (const account of (accounts || [])) {
    const status = await checkAccountInUnipile(account.unipile_account_id);
    const dbStatus = account.connection_status;
    const match = (status === 'OK' && dbStatus === 'connected') || (status !== 'OK' && dbStatus !== 'connected');

    const statusIcon = status === 'OK' ? '✅' : '❌';
    const matchIcon = match ? '' : ' ⚠️ MISMATCH';

    console.log(`${statusIcon} ${account.account_name}`);
    console.log(`   DB Status: ${dbStatus} | Unipile: ${status}${matchIcon}`);
    console.log(`   ID: ${account.unipile_account_id}`);
    console.log('');
  }
}

function checkAccountInUnipile(unipileAccountId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: `/api/v1/accounts/${unipileAccountId}`,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 404) {
          resolve('NOT FOUND');
        } else if (res.statusCode === 200) {
          try {
            const result = JSON.parse(data);
            resolve(result.status || result.connection_status || 'OK');
          } catch (e) {
            resolve('PARSE ERROR');
          }
        } else {
          resolve(`ERROR ${res.statusCode}`);
        }
      });
    });
    req.on('error', (e) => {
      resolve(`ERROR: ${e.message}`);
    });
    req.end();
  });
}

check();
