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
  // 1. Check reply agent config for InnovareAI
  await makeRequest(
    `/rest/v1/workspace_reply_agent_config?workspace_id=eq.${INNOVARE_WORKSPACE}`,
    'Reply Agent Config (InnovareAI)'
  );

  // 2. Check reply agent settings
  await makeRequest(
    `/rest/v1/reply_agent_settings?workspace_id=eq.${INNOVARE_WORKSPACE}`,
    'Reply Agent Settings (InnovareAI)'
  );

  // 3. Check pending drafts
  await makeRequest(
    `/rest/v1/reply_agent_drafts?workspace_id=eq.${INNOVARE_WORKSPACE}&status=in.(pending_generation,pending_approval)&select=id,prospect_name,status,created_at,inbound_message_text&order=created_at.desc&limit=10`,
    'Pending Reply Drafts'
  );

  // 4. Check recent drafts (any status)
  await makeRequest(
    `/rest/v1/reply_agent_drafts?workspace_id=eq.${INNOVARE_WORKSPACE}&select=id,prospect_name,status,created_at&order=created_at.desc&limit=10`,
    'Recent Reply Drafts (All Status)'
  );

  // 5. Check prospects with status=replied (should trigger reply agent)
  await makeRequest(
    `/rest/v1/campaign_prospects?status=eq.replied&select=id,full_name,company_name,status,responded_at,last_message_from_prospect&order=responded_at.desc&limit=10`,
    'Prospects with status=replied'
  );

  // 6. Check prospects with recent responses
  await makeRequest(
    `/rest/v1/campaign_prospects?responded_at=not.is.null&select=id,full_name,company_name,status,responded_at&order=responded_at.desc&limit=15`,
    'Prospects who responded (any status)'
  );

  // 7. Check connected prospects (these should be polled for replies)
  await makeRequest(
    `/rest/v1/campaign_prospects?status=in.(connected,connection_request_sent)&select=id,full_name,company_name,status&order=updated_at.desc&limit=10`,
    'Connected prospects awaiting replies'
  );

  // 8. Check all workspaces with reply agent enabled
  await makeRequest(
    `/rest/v1/workspace_reply_agent_config?enabled=eq.true&select=workspace_id,enabled,approval_mode`,
    'All workspaces with Reply Agent enabled'
  );
}

main();
