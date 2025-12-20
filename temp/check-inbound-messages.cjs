const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('🔍 Checking for INBOUND LinkedIn messages...\n');

  // Get Irish's account specifically (she's mentioned by user)
  const accounts = [
    { name: 'Irish Maguad', unipile_id: 'ymtTx4xVQ6OVUFk8PeUK-g' },
    { name: 'Charissa Saniel', unipile_id: '4nt1J-blSnGUPBjj4Ks2aA' },
    { name: 'Thorsten Linz', unipile_id: '09Uv5wIaSFOiN2gVA2mHSQ' },
  ];

  for (const account of accounts) {
    console.log(`\n======= ${account.name} =======`);
    await fetchMessages(account.unipile_id);
  }
}

function fetchMessages(unipileAccountId) {
  return new Promise((resolve) => {
    // Query messages directly instead of chats
    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: `/api/v1/messages?account_id=${unipileAccountId}&limit=20`,
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
          const messages = result.items || [];

          // Filter to only INBOUND messages (is_sender = 0)
          const inbound = messages.filter(m => m.is_sender === 0);

          console.log(`  Total messages: ${messages.length}, Inbound: ${inbound.length}`);

          if (inbound.length === 0) {
            console.log('  ❌ No inbound messages found');
          } else {
            console.log('\n  📬 INBOUND Messages:');
            inbound.slice(0, 5).forEach((msg, i) => {
              console.log(`\n    ${i+1}. From: ${msg.sender_name || msg.sender_id || 'Unknown'}`);
              console.log(`       Date: ${msg.created_at}`);
              console.log(`       Text: "${msg.text?.slice(0, 100) || 'N/A'}..."`);
              console.log(`       Chat ID: ${msg.chat_id}`);
              console.log(`       Sender ID: ${msg.sender_id}`);
            });
          }

          // Also show recent outbound to understand timing
          const outbound = messages.filter(m => m.is_sender === 1);
          if (outbound.length > 0) {
            console.log('\n  📤 Recent OUTBOUND (for context):');
            outbound.slice(0, 3).forEach((msg, i) => {
              console.log(`    ${i+1}. To: ${msg.recipient_name || msg.recipient_id || 'Unknown'} - ${msg.created_at?.slice(0,10)}`);
            });
          }

        } catch (e) {
          console.log('  Error parsing response:', e.message);
          console.log('  Raw:', data.slice(0, 500));
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
