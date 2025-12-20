const https = require('https');

const INNOVARE_WORKSPACE = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
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
  // 1. Check prospects with status=replied (use correct column names)
  await makeRequest(
    `/rest/v1/campaign_prospects?status=eq.replied&select=id,first_name,last_name,company_name,status,responded_at,last_message_from_prospect&order=responded_at.desc&limit=10`,
    'Prospects with status=replied'
  );

  // 2. Check prospects who responded recently
  await makeRequest(
    `/rest/v1/campaign_prospects?responded_at=not.is.null&select=id,first_name,last_name,company_name,status,responded_at&order=responded_at.desc&limit=15`,
    'Prospects who responded (any status)'
  );

  // 3. Check connected prospects (these should be polled for replies)
  await makeRequest(
    `/rest/v1/campaign_prospects?status=in.(connected,connection_request_sent)&select=id,first_name,last_name,company_name,status,campaign_id&order=updated_at.desc&limit=10`,
    'Connected prospects awaiting replies'
  );

  // 4. Check LinkedIn accounts for InnovareAI workspace
  await makeRequest(
    `/rest/v1/user_unipile_accounts?workspace_id=eq.${INNOVARE_WORKSPACE}&provider=eq.LINKEDIN&select=id,unipile_account_id,status,owner_name,owner_email`,
    'LinkedIn Accounts (InnovareAI)'
  );

  // 5. Check all LinkedIn accounts (any workspace)
  await makeRequest(
    `/rest/v1/user_unipile_accounts?provider=eq.LINKEDIN&select=id,unipile_account_id,status,owner_name,workspace_id&limit=20`,
    'All LinkedIn Accounts'
  );

  // 6. Check active campaigns that might have replies
  await makeRequest(
    `/rest/v1/campaigns?workspace_id=eq.${INNOVARE_WORKSPACE}&status=in.(active,running)&select=id,name,linkedin_account_id,status&limit=10`,
    'Active Campaigns (InnovareAI)'
  );

  // 7. Check reply agent metrics / last run
  await makeRequest(
    `/rest/v1/reply_agent_metrics?workspace_id=eq.${INNOVARE_WORKSPACE}&order=created_at.desc&limit=5`,
    'Reply Agent Metrics (last runs)'
  );
}

main();
