import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Check workspace_accounts - the correct table
  const { data: accounts, error: accErr } = await supabase
    .from('workspace_accounts')
    .select('*')
    .limit(5);

  console.log('=== WORKSPACE_ACCOUNTS (first 5) ===');
  console.log('Error:', accErr);
  if (accounts && accounts.length > 0) {
    console.log('Columns:', Object.keys(accounts[0]).join(', '));
    accounts.forEach(a => {
      console.log(`  ${a.account_name || a.name}: ${a.unipile_account_id} (${a.account_type}, ${a.connection_status})`);
    });
  }

  // Now get a failed item and trace the account
  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, campaign_id, linkedin_account_id')
    .eq('status', 'failed')
    .limit(1)
    .single();

  if (failed) {
    console.log('\n=== FAILED ITEM TRACE ===');
    console.log('Queue ID:', failed.id.substring(0,8));
    console.log('linkedin_user_id:', failed.linkedin_user_id);
    console.log('Queue linkedin_account_id:', failed.linkedin_account_id);

    // Get campaign
    const { data: camp } = await supabase
      .from('campaigns')
      .select('name, linkedin_account_id, workspace_id')
      .eq('id', failed.campaign_id)
      .single();

    console.log('Campaign:', camp?.name);
    console.log('Campaign linkedin_account_id:', camp?.linkedin_account_id);

    // Get the actual Unipile account
    if (camp?.linkedin_account_id) {
      const { data: wsAccount } = await supabase
        .from('workspace_accounts')
        .select('*')
        .eq('id', camp.linkedin_account_id)
        .single();

      console.log('\nWorkspace Account:');
      console.log('  Name:', wsAccount?.account_name);
      console.log('  Unipile ID:', wsAccount?.unipile_account_id);
      console.log('  Status:', wsAccount?.connection_status);
    }
  }
}

check().catch(console.error);
