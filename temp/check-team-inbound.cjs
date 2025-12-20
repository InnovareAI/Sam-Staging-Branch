const https = require('https');

const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

const accounts = [
  { name: 'Irish Maguad', id: 'ymtTx4xVQ6OVUFk83ctwtA' },
  { name: 'Charissa Saniel', id: '4nt1J-blSnGUPBjH2Nfjpg' },
  { name: 'Michelle Gestuveo', id: 'aroiwOeQQo2S8_-FqLjzNw' },
];

async function check() {
  console.log('🔍 Checking for INBOUND messages from team accounts...\n');

  for (const account of accounts) {
    console.log(`\n======= ${account.name} =======`);
    await getMessages(account.id);
  }
}

function getMessages(accountId) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: `/api/v1/messages?account_id=${accountId}&limit=30`,
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

          // Filter to INBOUND only
          const inbound = messages.filter(m => m.is_sender === 0);

          console.log(`  Total: ${messages.length}, Inbound: ${inbound.length}`);

          if (inbound.length > 0) {
            console.log('\n  📬 INBOUND Messages:');
            inbound.slice(0, 8).forEach((msg, i) => {
              console.log(`\n    ${i+1}. From: ${msg.sender_name || msg.sender_id?.slice(0,20) || 'Unknown'}`);
              console.log(`       Date: ${msg.created_at || 'N/A'}`);
              console.log(`       Text: "${msg.text?.slice(0, 80) || 'N/A'}..."`);
            });
          } else {
            console.log('  ❌ No inbound messages found');
          }
        } catch (e) {
          console.log('  Error:', e.message);
        }
        resolve();
      });
    });
    req.on('error', (e) => { console.log('  Error:', e.message); resolve(); });
    req.end();
  });
}

check();
