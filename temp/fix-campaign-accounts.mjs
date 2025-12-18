import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

async function fixCampaignAccounts() {
  console.log('='.repeat(60));
  console.log('FIXING CAMPAIGN ACCOUNT MAPPINGS');
  console.log('='.repeat(60));

  // 1. Find campaigns with failed sends
  const { data: failedItems } = await supabase
    .from('send_queue')
    .select('campaign_id, error_message')
    .eq('status', 'failed')
    .ilike('error_message', '%Invalid account%');

  console.log('\nFailed items with Invalid account error:', failedItems?.length || 0);

  // Get unique campaign IDs
  const campaignIds = [...new Set(failedItems?.map(i => i.campaign_id) || [])];
  console.log('Affected campaigns:', campaignIds.length);

  // 2. For each campaign, find correct LinkedIn account
  for (const campaignId of campaignIds) {
    console.log('\n' + '-'.repeat(40));

    // Get campaign details
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, campaign_name, name, workspace_id, linkedin_account_id')
      .eq('id', campaignId)
      .single();

    if (!campaign) {
      console.log('Campaign not found:', campaignId);
      continue;
    }

    console.log('Campaign:', campaign.campaign_name || campaign.name);
    console.log('Workspace ID:', campaign.workspace_id);
    console.log('Current LinkedIn Account ID:', campaign.linkedin_account_id);

    // Get current account info
    if (campaign.linkedin_account_id) {
      const { data: currentAccount } = await supabase
        .from('workspace_accounts')
        .select('id, account_name, account_type, unipile_account_id')
        .eq('id', campaign.linkedin_account_id)
        .single();

      if (currentAccount) {
        console.log('Current account:', currentAccount.account_name, '(' + currentAccount.account_type + ')');
      }
    }

    // Find correct LinkedIn account for this workspace
    const { data: linkedinAccounts } = await supabase
      .from('workspace_accounts')
      .select('id, account_name, account_type, unipile_account_id, connection_status')
      .eq('workspace_id', campaign.workspace_id)
      .eq('account_type', 'linkedin')
      .eq('is_active', true);

    console.log('\nAvailable LinkedIn accounts in workspace:', linkedinAccounts?.length || 0);

    if (!linkedinAccounts || linkedinAccounts.length === 0) {
      console.log('  NO LinkedIn accounts found - cannot fix');
      continue;
    }

    for (const acc of linkedinAccounts) {
      console.log('  -', acc.account_name, '|', acc.unipile_account_id, '|', acc.connection_status);
    }

    // Use first connected LinkedIn account
    const connectedAccount = linkedinAccounts.find(a => a.connection_status === 'connected') || linkedinAccounts[0];

    if (connectedAccount.id !== campaign.linkedin_account_id) {
      console.log('\n  FIXING: Updating campaign to use:', connectedAccount.account_name);

      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ linkedin_account_id: connectedAccount.id })
        .eq('id', campaignId);

      if (updateError) {
        console.log('  ERROR updating campaign:', updateError.message);
      } else {
        console.log('  SUCCESS: Campaign updated');

        // Reset failed queue items for this campaign
        const { data: resetData, error: resetError } = await supabase
          .from('send_queue')
          .update({
            status: 'pending',
            error_message: null,
            scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 min from now
          })
          .eq('campaign_id', campaignId)
          .eq('status', 'failed')
          .select('id');

        if (resetError) {
          console.log('  ERROR resetting queue items:', resetError.message);
        } else {
          console.log('  SUCCESS: Reset', resetData?.length || 0, 'queue items');
        }
      }
    } else {
      console.log('\n  Account already correct, checking Unipile ID...');
    }
  }

  // 3. Also fix workspace_accounts with wrong account_type
  console.log('\n' + '='.repeat(60));
  console.log('CHECKING WORKSPACE_ACCOUNTS FOR MISMATCHED TYPES');
  console.log('='.repeat(60));

  // Known Google OAuth accounts that are mislabeled
  const googleOAuthIds = ['jYXN8FeCTEukNSXDoaH3hA', 'rV0czB_nTLC8KSRb69_zRg'];

  for (const unipileId of googleOAuthIds) {
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('id, account_name, account_type, unipile_account_id')
      .eq('unipile_account_id', unipileId)
      .single();

    if (account && account.account_type === 'linkedin') {
      console.log('\nMislabeled account:', account.account_name);
      console.log('  Current type:', account.account_type);
      console.log('  Actual type: google_oauth');

      // Update to correct type
      const { error } = await supabase
        .from('workspace_accounts')
        .update({ account_type: 'email' }) // or 'google_oauth' if that's a valid type
        .eq('id', account.id);

      if (error) {
        console.log('  ERROR:', error.message);
      } else {
        console.log('  FIXED: Updated account type');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
  console.log('='.repeat(60));
}

fixCampaignAccounts().catch(console.error);
