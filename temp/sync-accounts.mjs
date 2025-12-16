import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

async function syncAccounts() {
  console.log('SYNCING ACCOUNTS');
  console.log('='.repeat(60));

  // 1. Find Stan Bounev's unipile account
  const { data: stanAccounts } = await supabase
    .from('unipile_accounts')
    .select('*')
    .ilike('account_name', '%Stan%');

  console.log('\nStan in unipile_accounts:', stanAccounts?.length || 0);

  for (const acc of stanAccounts || []) {
    console.log('\n  ' + acc.account_name);
    console.log('  Unipile ID: ' + acc.unipile_account_id);
    console.log('  Workspace ID: ' + acc.workspace_id);

    // Check if already synced to workspace_accounts
    const { data: wsAcc } = await supabase
      .from('workspace_accounts')
      .select('id')
      .eq('unipile_account_id', acc.unipile_account_id);

    if (!wsAcc || wsAcc.length === 0) {
      console.log('  -> Not synced, adding...');

      const { error } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: acc.workspace_id,
          account_type: 'linkedin',
          account_identifier: acc.account_name,
          account_name: acc.account_name,
          unipile_account_id: acc.unipile_account_id,
          connection_status: acc.status || 'connected',
          is_active: true
        });

      if (error) {
        console.log('  ❌ Failed: ' + error.message);
      } else {
        console.log('  ✅ Synced!');
      }
    } else {
      console.log('  Already synced');
    }
  }

  // 2. Check Thorsten's connection
  console.log('\n' + '='.repeat(60));
  console.log('CHECKING THORSTEN');

  const { data: thorsten } = await supabase
    .from('workspace_accounts')
    .select('*')
    .ilike('account_name', '%Thorsten%');

  for (const acc of thorsten || []) {
    console.log('\n  ' + acc.account_name);
    console.log('  Connection status: ' + acc.connection_status);
    console.log('  Is active: ' + acc.is_active);
    console.log('  Unipile ID: ' + acc.unipile_account_id);
  }

  // Also check in unipile_accounts
  const { data: thorstenUnipile } = await supabase
    .from('unipile_accounts')
    .select('*')
    .ilike('account_name', '%Thorsten%');

  console.log('\nThorsten in unipile_accounts:');
  for (const acc of thorstenUnipile || []) {
    console.log('  Status: ' + acc.status);
    console.log('  Last checked: ' + acc.last_checked_at);
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
}

syncAccounts().catch(console.error);
