const https = require('https');

const SUPABASE_URL = 'latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

// Search for Sara's draft
const searchDrafts = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/reply_agent_drafts?select=id,prospect_id,draft_text,inbound_message_text,status&status=eq.pending_approval&order=created_at.desc&limit=10',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
};

// Also search for Sara by name in prospects
const searchProspect = () => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/campaign_prospects?first_name=ilike.Sara&last_name=ilike.Ritchie&select=id,first_name,last_name,email',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
};

async function main() {
  console.log('Searching for pending drafts...\n');
  const drafts = await searchDrafts();
  console.log('Found drafts:', JSON.stringify(drafts, null, 2));

  console.log('\n\nSearching for Sara Ritchie prospect...');
  const prospects = await searchProspect();
  console.log('Found prospects:', JSON.stringify(prospects, null, 2));
}

main().catch(console.error);
