const https = require('https');

const WORKSPACE_ID = 'cd57981a-e63b-401c-bde1-ac71752c2293';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

// Check user_unipile_accounts
const req1 = https.request({
  hostname: 'latxadqrvrrrcvkktrog.supabase.co',
  path: `/rest/v1/user_unipile_accounts?workspace_id=eq.${WORKSPACE_ID}&select=id,unipile_account_id,provider,status`,
  method: 'GET',
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('=== user_unipile_accounts ===');
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  });
});
req1.end();

// Check workspace_accounts
const req2 = https.request({
  hostname: 'latxadqrvrrrcvkktrog.supabase.co',
  path: `/rest/v1/workspace_accounts?workspace_id=eq.${WORKSPACE_ID}&select=id,unipile_account_id,account_type,connection_status`,
  method: 'GET',
  headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('\n=== workspace_accounts ===');
    console.log(JSON.stringify(JSON.parse(data), null, 2));
  });
});
req2.end();
