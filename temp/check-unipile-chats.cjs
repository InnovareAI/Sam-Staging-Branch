const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('🔍 Checking for LinkedIn replies in Unipile...\n');

  // Get all LinkedIn accounts
  const { data: accounts, error } = await supabase
    .from('user_unipile_accounts')
    .select('id, unipile_account_id, account_name, platform, connection_status')
    .eq('platform', 'LINKEDIN')
    .in('connection_status', ['connected', 'active']);

  if (error) {
    console.log('Error fetching accounts:', error.message);
    return;
  }

  console.log(`Found ${accounts?.length || 0} LinkedIn accounts:\n`);

  for (const account of (accounts || [])) {
    console.log(`\n📱 ${account.account_name} (${account.unipile_account_id?.slice(0, 15)}...)`);
    await fetchChats(account.unipile_account_id);
  }

  // Also check workspace_accounts
  const { data: wsAccounts } = await supabase
    .from('workspace_accounts')
    .select('id, unipile_account_id, account_name, account_type, connection_status')
    .eq('account_type', 'linkedin')
    .in('connection_status', ['connected', 'active']);

  if (wsAccounts?.length) {
    console.log(`\n\n=== Also found ${wsAccounts.length} workspace LinkedIn accounts ===\n`);
    for (const account of wsAccounts) {
      console.log(`\n📱 ${account.account_name} (${account.unipile_account_id?.slice(0, 15)}...)`);
      await fetchChats(account.unipile_account_id);
    }
  }
}

function fetchChats(unipileAccountId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: `/api/v1/chats?account_id=${unipileAccountId}&limit=15`,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const chats = result.items || [];
          console.log(`  📨 Recent chats (${chats.length}):`);

          chats.slice(0, 8).forEach((chat, i) => {
            const isInbound = chat.last_message_is_sender === 0;
            const indicator = isInbound ? '⬅️ INBOUND' : '➡️ outbound';
            console.log(`    ${i+1}. ${chat.attendee_name || 'Unknown'} ${indicator}`);
            console.log(`       "${chat.last_message_text?.slice(0, 60) || 'N/A'}..."`);
          });
        } catch (e) {
          console.log('  Error parsing response:', data.slice(0, 200));
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log('  Request error:', e.message);
      resolve();
    });
    req.end();
  });
}

check();
