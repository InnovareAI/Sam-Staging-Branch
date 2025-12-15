const https = require('https');

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const UNIPILE_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';

// Get overdue queue items
async function getOverdueItems() {
  return new Promise((resolve) => {
    const now = new Date().toISOString();
    const req = https.request({
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: `/rest/v1/send_queue?select=*,campaign_prospects(linkedin_url,first_name,last_name),campaigns(linkedin_account_id)&status=eq.pending&scheduled_for=lt.${now}&order=scheduled_for.asc&limit=5`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.end();
  });
}

// Send connection request via Unipile
async function sendConnectionRequest(accountId, recipientId, message) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      provider_id: recipientId,
      message: message
    });

    const req = https.request({
      hostname: 'api6.unipile.com',
      port: 13670,
      path: `/api/v1/users/invite`,
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_KEY,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (e) => resolve({ status: 500, body: e.message }));
    req.write(postData);
    req.end();
  });
}

// Update queue item status
async function updateQueueItem(id, status, errorMessage = null) {
  return new Promise((resolve) => {
    const update = {
      status: status,
      updated_at: new Date().toISOString()
    };
    if (status === 'sent') {
      update.sent_at = new Date().toISOString();
    }
    if (errorMessage) {
      update.error_message = errorMessage;
    }

    const postData = JSON.stringify(update);
    const req = https.request({
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: `/rest/v1/send_queue?id=eq.${id}`,
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, (res) => {
      resolve(res.statusCode === 204);
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

// Update prospect status
async function updateProspectStatus(prospectId, status) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      status: status,
      contacted_at: new Date().toISOString()
    });

    const req = https.request({
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: `/rest/v1/campaign_prospects?id=eq.${prospectId}`,
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, (res) => {
      resolve(res.statusCode === 204);
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('🔄 Manual Queue Processor');
  console.log('========================\n');

  const items = await getOverdueItems();
  console.log(`Found ${items.length} overdue items\n`);

  if (items.length === 0) {
    console.log('No items to process');
    return;
  }

  for (const item of items) {
    const prospectName = item.campaign_prospects ?
      `${item.campaign_prospects.first_name} ${item.campaign_prospects.last_name || ''}`.trim() :
      'Unknown';
    const accountId = item.campaigns?.linkedin_account_id || item.linkedin_user_id;

    console.log(`Processing: ${prospectName}`);
    console.log(`  Queue ID: ${item.id}`);
    console.log(`  LinkedIn User ID: ${item.linkedin_user_id}`);
    console.log(`  Account ID: ${accountId}`);
    console.log(`  Message: "${item.message.substring(0, 50)}..."`);

    // For now, just show what we'd do - uncomment to actually send
    // const result = await sendConnectionRequest(accountId, item.linkedin_user_id, item.message);
    // console.log(`  Result: ${result.status} - ${result.body.substring(0, 100)}`);

    // Mark as processing to prevent duplicate sends
    // await updateQueueItem(item.id, 'sent');
    // await updateProspectStatus(item.prospect_id, 'connection_request_sent');

    console.log('');
  }

  console.log('Done! (Dry run - uncomment to actually send)');
}

main().catch(console.error);
