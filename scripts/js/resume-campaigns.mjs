#!/usr/bin/env node
/**
 * Resume paused campaigns for specified accounts
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resumeCampaigns() {
  console.log('Resuming campaigns for specified accounts...\n');

  // Get all accounts
  const { data: allAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name');

  // Find target accounts (Charissa has Unicode chars, so match by contains)
  const targetNames = ['charissa', 'brian', 'rony', 'samantha', 'thorsten', 'michelle'];
  const targetAccounts = allAccounts.filter(a =>
    targetNames.some(n => a.account_name.toLowerCase().includes(n))
  );

  console.log('Target accounts:');
  targetAccounts.forEach(a => console.log('  -', a.account_name));

  const accountIds = targetAccounts.map(a => a.id);

  // Get campaigns for these accounts that are paused or have pending queue items
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, linkedin_account_id, timezone, country_code')
    .in('linkedin_account_id', accountIds);

  console.log('\nCampaigns found:', campaigns.length);

  // Resume paused campaigns
  const pausedCampaigns = campaigns.filter(c => c.status === 'paused');
  console.log('Paused campaigns to resume:', pausedCampaigns.length);

  if (pausedCampaigns.length > 0) {
    for (const camp of pausedCampaigns) {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', camp.id);

      if (error) {
        console.log('  Error resuming', camp.name, ':', error.message);
      } else {
        console.log('  ✅ Resumed:', camp.name);
      }
    }
  }

  // Check active campaigns with pending queue items
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  console.log('\nActive campaigns:', activeCampaigns.length);

  for (const camp of activeCampaigns) {
    const acct = targetAccounts.find(a => a.id === camp.linkedin_account_id);

    // Check queue for this campaign
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('id, status, scheduled_for')
      .eq('campaign_id', camp.id)
      .eq('status', 'pending');

    const pendingCount = queueItems?.length || 0;
    console.log(`  - ${camp.name} (${acct?.account_name}): ${pendingCount} pending`);
    console.log(`    TZ: ${camp.timezone || 'default'} | Country: ${camp.country_code || 'US'}`);
  }

  console.log('\n✅ Done!');
}

resumeCampaigns().catch(console.error);
