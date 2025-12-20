const https = require('https');

const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

function makeRequest(path, label) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: encodeURI(path),
      method: 'GET',
      headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n=== ${label} ===`);
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            console.log(`Found ${parsed.length} results`);
            console.log(JSON.stringify(parsed.slice(0, 3), null, 2));
          } else {
            console.log(JSON.stringify(parsed, null, 2));
          }
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
  // Test the EXACT join query from poll-message-replies
  // Query 1: First reply prospects
  await makeRequest(
    `/rest/v1/campaign_prospects?status=in.(connected,connection_request_sent)&responded_at=is.null&linkedin_user_id=not.is.null&select=id,first_name,last_name,linkedin_user_id,linkedin_url,company_name,title,status,responded_at,last_processed_message_id,campaign_id,campaigns(workspace_id,linkedin_account_id,workspace_accounts!linkedin_account_id(unipile_account_id))&order=updated_at.desc&limit=5`,
    'Poll Query 1 - First Reply Prospects (with join)'
  );

  // Simplified version without join
  await makeRequest(
    `/rest/v1/campaign_prospects?status=in.(connected,connection_request_sent)&responded_at=is.null&linkedin_user_id=not.is.null&select=id,first_name,last_name,campaign_id&order=updated_at.desc&limit=5`,
    'Poll Query 1 - Simplified (no join)'
  );

  // Query 2: Replied prospects for follow-ups
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  await makeRequest(
    `/rest/v1/campaign_prospects?status=eq.replied&linkedin_user_id=not.is.null&responded_at=gte.${sevenDaysAgo.toISOString()}&select=id,first_name,last_name,linkedin_user_id,linkedin_url,company_name,title,status,responded_at,last_processed_message_id,campaign_id,campaigns(workspace_id,linkedin_account_id,workspace_accounts!linkedin_account_id(unipile_account_id))&order=responded_at.desc&limit=5`,
    'Poll Query 2 - Replied Prospects (with join)'
  );

  // Test workspace_accounts join explicitly
  await makeRequest(
    `/rest/v1/campaigns?select=id,name,linkedin_account_id,workspace_accounts!linkedin_account_id(id,unipile_account_id)&limit=3`,
    'Test campaigns -> workspace_accounts join'
  );
}

main();
