import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

async function fixCampaigns() {
  console.log('='.repeat(60));
  console.log('FIXING CAMPAIGNS WITH WRONG ACCOUNT TYPES');
  console.log('='.repeat(60));

  // Find failed queue items
  const { data: failedItems } = await supabase
    .from('send_queue')
    .select('campaign_id, error_message')
    .eq('status', 'failed');

  console.log('\nTotal failed items:', failedItems?.length || 0);

  const campaignIds = [...new Set(failedItems?.map(i => i.campaign_id) || [])];

  for (const campaignId of campaignIds) {
    console.log('\n' + '-'.repeat(40));

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, campaign_name, name, workspace_id, linkedin_account_id')
      .eq('id', campaignId)
      .single();

    if (!campaign) continue;

    console.log('Campaign:', campaign.campaign_name || campaign.name);
    console.log('Workspace:', campaign.workspace_id);

    // Get current assigned account
    const { data: currentAcc } = await supabase
      .from('workspace_accounts')
      .select('id, account_name, account_type, unipile_account_id')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (currentAcc) {
      console.log('Current account:', currentAcc.account_name);
      console.log('  Type:', currentAcc.account_type);
      console.log('  Unipile ID:', currentAcc.unipile_account_id);

      // If it's NOT a linkedin type, we need to find an actual LinkedIn account
      if (currentAcc.account_type !== 'linkedin') {
        console.log('\n  This account is NOT linkedin type');

        // Find actual LinkedIn accounts in this workspace
        const { data: linkedinAccounts } = await supabase
          .from('workspace_accounts')
          .select('id, account_name, account_type, unipile_account_id, connection_status')
          .eq('workspace_id', campaign.workspace_id)
          .eq('account_type', 'linkedin')
          .eq('is_active', true);

        console.log('  Available LinkedIn accounts:', linkedinAccounts?.length || 0);

        if (linkedinAccounts && linkedinAccounts.length > 0) {
          const newAccount = linkedinAccounts.find(a => a.connection_status === 'connected') || linkedinAccounts[0];
          console.log('  Switching to:', newAccount.account_name);

          const { error } = await supabase
            .from('campaigns')
            .update({ linkedin_account_id: newAccount.id })
            .eq('id', campaignId);

          if (error) {
            console.log('  ERROR:', error.message);
          } else {
            console.log('  SUCCESS: Updated campaign');

            // Reset failed items
            const { data: reset } = await supabase
              .from('send_queue')
              .update({
                status: 'pending',
                error_message: null,
                scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString()
              })
              .eq('campaign_id', campaignId)
              .eq('status', 'failed')
              .select('id');

            console.log('  Reset', reset?.length || 0, 'queue items');
          }
        } else {
          console.log('  WARNING: No LinkedIn account available');
          console.log('  User needs to connect LinkedIn in Settings -> Integrations');
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  // Check remaining failed items
  const { data: remaining } = await supabase
    .from('send_queue')
    .select('id')
    .eq('status', 'failed');

  console.log('Remaining failed items:', remaining?.length || 0);
}

fixCampaigns().catch(console.error);
