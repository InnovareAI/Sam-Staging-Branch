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
  // Check campaigns for Rudy, Dan, Sara to see their linkedin_account_id
  const campaignIds = [
    '9bf18ec1-1018-46e4-8045-59a86bf13aa7', // Rudy
    '57fd7dfe-d735-4afe-ba98-e8283dd023c6', // Dan
    'd53a5d1a-5432-4724-9574-f795863805d5', // Sara, Caleb
  ];

  for (const id of campaignIds) {
    await makeRequest(
      `/rest/v1/campaigns?id=eq.${id}&select=id,name,linkedin_account_id,workspace_id`,
      `Campaign ${id}`
    );
  }

  // Check if linkedin_account_id maps to workspace_accounts
  await makeRequest(
    `/rest/v1/workspace_accounts?select=id,unipile_account_id,workspace_id`,
    'workspace_accounts (all)'
  );

  // Check user_unipile_accounts
  await makeRequest(
    `/rest/v1/user_unipile_accounts?select=id,unipile_account_id,workspace_id,owner_name`,
    'user_unipile_accounts (all)'
  );
}

main();
