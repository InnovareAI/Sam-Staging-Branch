require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

async function resolveVanityToProviderId(vanity, unipileAccountId) {
  const url = `${UNIPILE_BASE_URL}/api/v1/users/${encodeURIComponent(vanity)}?account_id=${unipileAccountId}`;

  const response = await fetch(url, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.title || error.message || `HTTP ${response.status}`);
  }

  const profile = await response.json();
  if (!profile.provider_id) {
    throw new Error(`No provider_id in response for: ${vanity}`);
  }

  return profile.provider_id;
}

(async () => {
  console.log('🔍 Finding pending queue items with vanities...\n');

  // Get pending queue items that don't have provider_id format
  const { data: pendingItems, error } = await supabase
    .from('send_queue')
    .select('id, prospect_id, linkedin_user_id, campaign_id')
    .eq('status', 'pending')
    .not('linkedin_user_id', 'is', null)
    .limit(50);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filter to only vanities (not provider_ids)
  const vanities = (pendingItems || []).filter(item => {
    const id = item.linkedin_user_id;
    return id && !id.startsWith('ACo') && !id.startsWith('ACw');
  });

  console.log(`Found ${vanities.length} queue items with vanities\n`);

  let resolved = 0;
  let failed = 0;

  for (const item of vanities) {
    // Get campaign and account info
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('linkedin_account_id')
      .eq('id', item.campaign_id)
      .single();

    if (!campaign) {
      console.log(`⚠️  ${item.linkedin_user_id}: Campaign not found`);
      failed++;
      continue;
    }

    // Try workspace_accounts first
    let { data: account } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('id', campaign.linkedin_account_id)
      .single();

    // Fallback to user_unipile_accounts
    if (!account) {
      const result = await supabase
        .from('user_unipile_accounts')
        .select('unipile_account_id')
        .eq('id', campaign.linkedin_account_id)
        .single();
      account = result.data;
    }

    const unipileAccountId = account?.unipile_account_id;

    if (!unipileAccountId) {
      console.log(`⚠️  ${item.linkedin_user_id}: No unipile account ID`);
      failed++;
      continue;
    }

    try {
      console.log(`🔍 Resolving "${item.linkedin_user_id}"...`);
      const providerId = await resolveVanityToProviderId(item.linkedin_user_id, unipileAccountId);

      // Update queue item AND prospect
      await supabase
        .from('send_queue')
        .update({ linkedin_user_id: providerId })
        .eq('id', item.id);

      await supabase
        .from('campaign_prospects')
        .update({ linkedin_user_id: providerId })
        .eq('id', item.prospect_id);

      resolved++;
      console.log(`✅ ${item.linkedin_user_id} → ${providerId}`);

      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err) {
      failed++;
      console.error(`❌ ${item.linkedin_user_id}: ${err.message}`);
    }
  }

  console.log(`\n✅ Resolved: ${resolved}`);
  console.log(`❌ Failed: ${failed}`);
})();
