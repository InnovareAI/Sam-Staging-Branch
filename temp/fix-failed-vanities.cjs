require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

async function resolveVanity(vanity, unipileAccountId) {
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
          reject(new Error('HTTP ' + res.statusCode + ': ' + data.substring(0, 100)));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.provider_id);
        } catch (e) {
          reject(new Error('Parse error: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  console.log('🔍 Finding failed queue items with vanity slugs...\n');

  // Get failed items with vanity slugs
  const { data: failed, error } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, campaign_id, error_message')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const vanityItems = (failed || []).filter(f =>
    f.linkedin_user_id &&
    !f.linkedin_user_id.startsWith('ACo') &&
    !f.linkedin_user_id.startsWith('ACw') &&
    f.error_message?.includes('does not match')
  );

  console.log('Found', vanityItems.length, 'failed items with vanity slugs needing resolution\n');

  let resolved = 0;
  let failed_count = 0;

  for (const item of vanityItems) {
    // Get campaign and account info
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('linkedin_account_id, workspace_id')
      .eq('id', item.campaign_id)
      .single();

    if (!campaign) {
      console.log('⚠️ No campaign for', item.linkedin_user_id);
      failed_count++;
      continue;
    }

    // Get Unipile account ID from workspace_accounts or user_unipile_accounts
    let unipileAccountId;

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

    if (!unipileAccountId) {
      console.log('⚠️ No Unipile account for', item.linkedin_user_id);
      failed_count++;
      continue;
    }

    console.log('🔍 Resolving:', item.linkedin_user_id);

    try {
      const providerId = await resolveVanity(item.linkedin_user_id, unipileAccountId);
      console.log('   ✅ Resolved to:', providerId);

      // Update queue item
      await supabase
        .from('send_queue')
        .update({
          linkedin_user_id: providerId,
          status: 'pending',
          error_message: null,
          retry_count: 0
        })
        .eq('id', item.id);

      console.log('   ✅ Queue item reset to pending');
      resolved++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.log('   ❌ Failed:', err.message);
      failed_count++;
    }
  }

  console.log('\n========================================');
  console.log('✅ Resolved:', resolved);
  console.log('❌ Failed:', failed_count);
  console.log('========================================');
})();
