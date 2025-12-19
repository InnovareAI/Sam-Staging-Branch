import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

console.log('🔧 Resolving Messenger Message IDs\n');

const queueIds = [
  '5fc20455-b41f-4576-8592-67063329cbd4',  // digitalnoah
  'ac5ecdce-5c3c-4ab3-8292-4bd0ae76c3b7'   // zebanderson
];

for (const queueId of queueIds) {
  const { data: item } = await supabase
    .from('send_queue')
    .select('*')
    .eq('id', queueId)
    .single();

  console.log(`\nProcessing: ${item.linkedin_user_id}`);

  // Check if it's already a provider_id
  if (item.linkedin_user_id.startsWith('ACo') || item.linkedin_user_id.startsWith('ACw')) {
    console.log('  Already a provider_id ✅');
    continue;
  }

  console.log('  Vanity slug - needs resolution');

  // Get campaign and account
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('name, linkedin_account_id')
    .eq('id', item.campaign_id)
    .single();

  const { data: account } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, account_name')
    .eq('id', campaign.linkedin_account_id)
    .single();

  console.log(`  Campaign: ${campaign.name}`);
  console.log(`  Account: ${account.account_name}`);

  // Resolve
  try {
    const url = `https://${UNIPILE_DSN}/api/v1/users/${encodeURIComponent(item.linkedin_user_id)}?account_id=${account.unipile_account_id}`;

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`  ❌ Resolution failed: ${response.status}`);
      continue;
    }

    const data = await response.json();

    if (!data.provider_id) {
      console.log('  ❌ No provider_id in response');
      continue;
    }

    console.log(`  ✅ Resolved to: ${data.provider_id}`);

    // Update database
    await supabase
      .from('send_queue')
      .update({
        linkedin_user_id: data.provider_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', queueId);

    if (item.prospect_id) {
      await supabase
        .from('campaign_prospects')
        .update({
          linkedin_user_id: data.provider_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.prospect_id);
    }

    console.log('  ✅ Database updated');

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }

  await new Promise(r => setTimeout(r, 1000));
}

console.log('\n✅ Done');
