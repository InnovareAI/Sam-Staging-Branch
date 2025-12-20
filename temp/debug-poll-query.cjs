const https = require('https');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

function makeRequest(path, label) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: path,
      method: 'GET',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n=== ${label} ===`);
        try {
          const parsed = JSON.parse(data);
          console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
          console.log(data);
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log(`\n=== ${label} - ERROR ===`);
      console.log(e.message);
      resolve();
    });
    req.end();
  });
}

async function main() {
  // 1. Test the exact query from poll-message-replies (first reply prospects)
  console.log('Testing poll-message-replies query...');

  // First, try to see if workspace_accounts table exists and has data
  await makeRequest(
    `/rest/v1/workspace_accounts?select=id,unipile_account_id,workspace_id&limit=5`,
    'workspace_accounts table'
  );

  // Check campaigns with linkedin_account_id
  await makeRequest(
    `/rest/v1/campaigns?select=id,name,linkedin_account_id,workspace_id&not.linkedin_account_id=is.null&limit=5`,
    'Campaigns with linkedin_account_id'
  );

  // Query replied prospects (Dec 17 Rudy, Dec 16 Dan/Sara)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  await makeRequest(
    `/rest/v1/campaign_prospects?status=eq.replied&responded_at=gte.${sevenDaysAgo.toISOString()}&select=id,first_name,last_name,linkedin_user_id,campaign_id&order=responded_at.desc&limit=10`,
    'Recently replied prospects (simple query)'
  );

  // Check if there are prospects waiting for first reply (connected but no responded_at)
  await makeRequest(
    `/rest/v1/campaign_prospects?status=in.(connected,connection_request_sent)&responded_at=is.null&select=id,first_name,last_name,linkedin_user_id,campaign_id&limit=10`,
    'Prospects awaiting first reply'
  );

  // Check user_unipile_accounts for InnovareAI workspace
  await makeRequest(
    `/rest/v1/user_unipile_accounts?workspace_id=eq.babdcab8-1a78-4b2f-913e-6e9fd9821009&select=id,unipile_account_id,provider,owner_name`,
    'InnovareAI LinkedIn accounts (user_unipile_accounts)'
  );
}

main();
