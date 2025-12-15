const https = require('https');

const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const UNIPILE_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';

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

  console.log(`  🔍 Resolving vanity: ${vanity}`);
  const result = await unipileRequest(`/users/${encodeURIComponent(vanity)}?account_id=${accountId}`);

  if (result.status !== 200 || !result.data.provider_id) {
    throw new Error(`Could not resolve provider_id for: ${vanity} - ${JSON.stringify(result)}`);
  }

  console.log(`  ✅ Resolved to: ${result.data.provider_id}`);
  return result.data.provider_id;
}

async function main() {
  console.log('🔄 Processing One Queue Item');
  console.log('============================\n');

  // Get the oldest pending overdue item
  const now = new Date().toISOString();
  const items = await supabaseRequest(
    `/send_queue?select=*,campaign_prospects(linkedin_url,first_name,last_name,id),campaigns(linkedin_account_id,name)&status=eq.pending&scheduled_for=lt.${now}&order=scheduled_for.asc&limit=1`
  );

  if (!Array.isArray(items) || items.length === 0) {
    console.log('No pending overdue items');
    return;
  }

  const item = items[0];
  const prospect = item.campaign_prospects;
  const campaign = item.campaigns;
  const prospectName = prospect ? `${prospect.first_name} ${prospect.last_name || ''}`.trim() : 'Unknown';

  console.log(`Processing: ${prospectName}`);
  console.log(`  Campaign: ${campaign?.name || 'Unknown'}`);
  console.log(`  Queue ID: ${item.id}`);
  console.log(`  LinkedIn User ID: ${item.linkedin_user_id}`);
  console.log(`  Campaign linkedin_account_id (UUID): ${campaign?.linkedin_account_id}`);
  console.log(`  Message: "${item.message.substring(0, 60)}..."`);

  if (!campaign?.linkedin_account_id) {
    console.log('\n❌ No LinkedIn account ID for campaign!');
    return;
  }

  // Look up the actual Unipile account ID from workspace_accounts
  const workspaceAccounts = await supabaseRequest(`/workspace_accounts?id=eq.${campaign.linkedin_account_id}&select=unipile_account_id,account_name`);
  if (!Array.isArray(workspaceAccounts) || workspaceAccounts.length === 0) {
    console.log('\n❌ Workspace account not found for UUID:', campaign.linkedin_account_id);
    return;
  }

  const unipileAccountId = workspaceAccounts[0].unipile_account_id;
  console.log(`  Unipile Account ID: ${unipileAccountId} (${workspaceAccounts[0].account_name})`)

  try {
    // Step 1: Resolve to provider_id if needed
    const providerId = await resolveToProviderId(item.linkedin_user_id, unipileAccountId);

    // Step 2: Update queue with resolved provider_id
    if (providerId !== item.linkedin_user_id) {
      await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', { linkedin_user_id: providerId });
      await supabaseRequest(`/campaign_prospects?id=eq.${prospect.id}`, 'PATCH', { linkedin_user_id: providerId });
      console.log(`  📝 Updated records with provider_id`);
    }

    // Step 3: Send connection request
    console.log(`\n📨 Sending connection request...`);
    const payload = {
      account_id: unipileAccountId,
      provider_id: providerId,
      message: item.message
    };
    console.log(`  Payload:`, JSON.stringify(payload, null, 2));

    const sendResult = await unipileRequest('/users/invite', 'POST', payload);
    console.log(`  Response: ${sendResult.status}`);

    if (sendResult.status === 201 || sendResult.status === 200) {
      // Step 4: Mark as sent
      await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', {
        status: 'sent',
        sent_at: new Date().toISOString()
      });
      await supabaseRequest(`/campaign_prospects?id=eq.${prospect.id}`, 'PATCH', {
        status: 'connection_request_sent',
        contacted_at: new Date().toISOString()
      });

      console.log(`\n✅ SUCCESS! Connection request sent to ${prospectName}`);
    } else {
      console.log(`\n❌ FAILED: ${JSON.stringify(sendResult.data || sendResult.raw)}`);

      // Check for specific errors
      const errorMsg = sendResult.data?.message || sendResult.raw || 'Unknown error';

      if (errorMsg.includes('withdrawn') || errorMsg.includes('already connected')) {
        await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', {
          status: 'failed',
          error_message: errorMsg
        });
        console.log(`  Marked as failed`);
      }
    }

  } catch (error) {
    console.log(`\n❌ ERROR: ${error.message}`);
    await supabaseRequest(`/send_queue?id=eq.${item.id}`, 'PATCH', {
      status: 'failed',
      error_message: error.message
    });
  }
}

main().catch(console.error);
