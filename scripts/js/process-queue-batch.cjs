const https = require('https');

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const UNIPILE_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';

const BATCH_SIZE = parseInt(process.argv[2]) || 5;
const DELAY_BETWEEN_MS = 3000; // 3 seconds between sends

// Promisified Supabase request
function supabaseRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: '/rest/v1' + path,
      method: method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    };
    if (method === 'PATCH') {
      options.headers['Prefer'] = 'return=minimal';
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 204) {
          resolve({ success: true });
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data, status: res.statusCode });
          }
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Promisified Unipile request
function unipileRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api6.unipile.com',
      port: 13670,
      path: '/api/v1' + path,
      method: method,
      headers: {
        'X-API-KEY': UNIPILE_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Resolve URL/vanity to provider_id
async function resolveToProviderId(linkedinUserIdOrUrl, accountId) {
  if (linkedinUserIdOrUrl.startsWith('ACo') || linkedinUserIdOrUrl.startsWith('ACw')) {
    return linkedinUserIdOrUrl;
  }

  let vanity = linkedinUserIdOrUrl;
  if (linkedinUserIdOrUrl.includes('linkedin.com')) {
    const match = linkedinUserIdOrUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (match) vanity = match[1];
  }

  const result = await unipileRequest(`/users/${encodeURIComponent(vanity)}?account_id=${accountId}`);

  if (result.status !== 200 || !result.data.provider_id) {
    throw new Error(`Could not resolve: ${vanity}`);
  }

  return result.data.provider_id;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processOne(item, workspaceAccountsCache) {
  const prospect = item.campaign_prospects;
  const campaign = item.campaigns;
  const prospectName = prospect ? `${prospect.first_name} ${prospect.last_name || ''}`.trim() : 'Unknown';

  // Get Unipile account from cache or fetch
  if (!workspaceAccountsCache[campaign.linkedin_account_id]) {
    const accounts = await supabaseRequest(`/workspace_accounts?id=eq.${campaign.linkedin_account_id}&select=unipile_account_id,account_name`);
    if (Array.isArray(accounts) && accounts.length > 0) {
      workspaceAccountsCache[campaign.linkedin_account_id] = accounts[0];
    }
  }

  const wsAccount = workspaceAccountsCache[campaign.linkedin_account_id];
  if (!wsAccount) {
    console.log(`❌ ${prospectName}: No workspace account found`);
    await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', {
      status: 'failed',
      error_message: 'Workspace account not found'
    });
    return false;
  }

  const unipileAccountId = wsAccount.unipile_account_id;

  try {
    // Resolve provider_id
    const providerId = await resolveToProviderId(item.linkedin_user_id, unipileAccountId);

    // Update records with resolved ID if needed
    if (providerId !== item.linkedin_user_id) {
      await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', { linkedin_user_id: providerId });
      await supabaseRequest(`/campaign_prospects?id=eq.${prospect.id}`, 'PATCH', { linkedin_user_id: providerId });
    }

    // Send connection request
    const payload = {
      account_id: unipileAccountId,
      provider_id: providerId,
      message: item.message
    };

    const sendResult = await unipileRequest('/users/invite', 'POST', payload);

    if (sendResult.status === 201 || sendResult.status === 200) {
      await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', {
        status: 'sent',
        sent_at: new Date().toISOString()
      });
      await supabaseRequest(`/campaign_prospects?id=eq.${prospect.id}`, 'PATCH', {
        status: 'connection_request_sent',
        contacted_at: new Date().toISOString()
      });

      console.log(`✅ ${prospectName} → ${wsAccount.account_name}`);
      return true;
    } else {
      const errorMsg = sendResult.data?.message || sendResult.data?.detail || 'Unknown error';
      await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', {
        status: 'failed',
        error_message: errorMsg
      });
      console.log(`❌ ${prospectName}: ${errorMsg}`);
      return false;
    }
  } catch (error) {
    await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', {
      status: 'failed',
      error_message: error.message
    });
    console.log(`❌ ${prospectName}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(`🔄 Processing ${BATCH_SIZE} Queue Items`);
  console.log('================================\n');

  const now = new Date().toISOString();
  const items = await supabaseRequest(
    `/send_queue?select=*,campaign_prospects(linkedin_url,first_name,last_name,id),campaigns(linkedin_account_id,name)&status=eq.pending&scheduled_for=lt.${now}&order=scheduled_for.asc&limit=${BATCH_SIZE}`
  );

  if (!Array.isArray(items) || items.length === 0) {
    console.log('No pending overdue items');
    return;
  }

  console.log(`Found ${items.length} items to process\n`);

  const workspaceAccountsCache = {};
  let success = 0;
  let failed = 0;

  for (const item of items) {
    const result = await processOne(item, workspaceAccountsCache);
    if (result) success++;
    else failed++;

    // Delay between sends
    if (items.indexOf(item) < items.length - 1) {
      await sleep(DELAY_BETWEEN_MS);
    }
  }

  console.log(`\n================================`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
}

main().catch(console.error);
