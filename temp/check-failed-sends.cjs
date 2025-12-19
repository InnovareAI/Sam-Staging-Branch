require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

  // Get failed items
  const result = await supabase
    .from('send_queue')
    .select('id, prospect_id, campaign_id')
    .eq('status', 'failed')
    .not('error_message', 'is', null)
    .gte('updated_at', fifteenMinAgo.toISOString())
    .limit(3);

  const failedItems = result.data;

  if (!failedItems || failedItems.length === 0) {
    console.log('No failed items found');
    return;
  }

  for (const item of failedItems) {
    console.log('\n=== Queue Item:', item.id, '===');

    // Get prospect
    const prospectResult = await supabase
      .from('campaign_prospects')
      .select('linkedin_id, linkedin_url, first_name, last_name, provider_id')
      .eq('id', item.prospect_id)
      .single();

    const prospect = prospectResult.data;
    console.log('Prospect:', prospect?.first_name, prospect?.last_name);
    console.log('Prospect LinkedIn ID:', prospect?.linkedin_id);
    console.log('Prospect LinkedIn URL:', prospect?.linkedin_url);
    console.log('Prospect provider_id:', prospect?.provider_id);

    // Get campaign and account
    const campaignResult = await supabase
      .from('campaigns')
      .select('linkedin_account_id')
      .eq('id', item.campaign_id)
      .single();

    const campaign = campaignResult.data;
    if (campaign) {
      const accountResult = await supabase
        .from('linkedin_accounts')
        .select('unipile_account_id, provider_id')
        .eq('id', campaign.linkedin_account_id)
        .single();

      const account = accountResult.data;
      console.log('Account provider_id:', account?.provider_id);
      console.log('Unipile account ID:', account?.unipile_account_id);
    }
  }
})();
