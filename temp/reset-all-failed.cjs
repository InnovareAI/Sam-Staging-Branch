require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

function resolveVanity(vanity, unipileAccountId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api6.unipile.com',
      port: 13670,
      path: '/api/v1/users/' + encodeURIComponent(vanity) + '?account_id=' + unipileAccountId,
      method: 'GET',
      headers: { 'X-API-KEY': UNIPILE_API_KEY, 'Accept': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode));
          return;
        }
        try { resolve(JSON.parse(data).provider_id); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('🔍 Finding all failed queue items...\n');

  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, campaign_id, error_message')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(100);

  console.log('Found', failed?.length || 0, 'failed items\n');

  let fixed = 0;
  let errors = 0;

  for (const item of (failed || [])) {
    const isVanity = item.linkedin_user_id &&
      !item.linkedin_user_id.startsWith('ACo') &&
      !item.linkedin_user_id.startsWith('ACw');

    // Get campaign and Unipile account
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('linkedin_account_id')
      .eq('id', item.campaign_id)
      .single();

    let unipileAccountId;
    if (campaign) {
      const { data: wsAccount } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id')
        .eq('id', campaign.linkedin_account_id)
        .single();

      if (wsAccount?.unipile_account_id) {
        unipileAccountId = wsAccount.unipile_account_id;
      } else {
        const { data: uuAccount } = await supabase
          .from('user_unipile_accounts')
          .select('unipile_account_id')
          .eq('id', campaign.linkedin_account_id)
          .single();
        unipileAccountId = uuAccount?.unipile_account_id;
      }
    }

    console.log('Processing:', item.linkedin_user_id, isVanity ? '(vanity)' : '(provider_id)');

    let providerId = item.linkedin_user_id;

    if (isVanity && unipileAccountId) {
      try {
        providerId = await resolveVanity(item.linkedin_user_id, unipileAccountId);
        console.log('  ✅ Resolved:', providerId);
      } catch (e) {
        console.log('  ❌ Resolution failed:', e.message);
        errors++;
        continue;
      }
    }

    // Reset to pending
    await supabase
      .from('send_queue')
      .update({
        linkedin_user_id: providerId,
        status: 'pending',
        error_message: null,
        retry_count: 0
      })
      .eq('id', item.id);

    console.log('  ✅ Reset to pending');
    fixed++;

    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n========================================');
  console.log('✅ Fixed:', fixed);
  console.log('❌ Errors:', errors);
  console.log('========================================');
})();
