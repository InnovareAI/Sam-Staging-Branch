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
  // Check for new pending drafts (created in last 10 minutes)
  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

  await makeRequest(
    `/rest/v1/reply_agent_drafts?created_at=gte.${tenMinutesAgo.toISOString()}&select=id,prospect_name,status,created_at,inbound_message_text&order=created_at.desc&limit=10`,
    'Drafts created in last 10 minutes'
  );

  // Check for ALL pending drafts
  await makeRequest(
    `/rest/v1/reply_agent_drafts?status=in.(pending_generation,pending_approval)&select=id,prospect_name,status,created_at,inbound_message_text&order=created_at.desc&limit=10`,
    'All pending drafts'
  );

  // Check recent replied prospects
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 3);

  await makeRequest(
    `/rest/v1/campaign_prospects?status=eq.replied&responded_at=gte.${oneDayAgo.toISOString()}&select=id,first_name,last_name,company_name,responded_at,campaign_id,campaigns(workspace_id,linkedin_account_id)&order=responded_at.desc&limit=10`,
    'Recently replied prospects (last 3 days)'
  );
}

main();
