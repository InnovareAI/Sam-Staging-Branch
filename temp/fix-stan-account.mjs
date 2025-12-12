import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function fix() {
  // Find Stan Bounev's user_unipile_accounts entry
  const { data: userAccounts, error: userError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .ilike('account_name', '%Stan%');

  if (userError) {
    console.error('Error finding Stan account:', userError);
    return;
  }

  console.log('Found user_unipile_accounts for Stan:', userAccounts?.length || 0);

  for (const account of userAccounts || []) {
    console.log('\nAccount:', account.account_name);
    console.log('  User ID:', account.user_id);
    console.log('  Unipile Account ID:', account.unipile_account_id);
    console.log('  Platform:', account.platform);
    console.log('  Status:', account.connection_status);

    // Find user's workspaces
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('user_id', account.user_id)
      .eq('status', 'active');

    console.log('  Workspaces:', memberships?.map(m => m.workspaces?.name).join(', ') || 'None');

    // Check if already in workspace_accounts
    for (const membership of memberships || []) {
      const { data: existing } = await supabase
        .from('workspace_accounts')
        .select('id')
        .eq('workspace_id', membership.workspace_id)
        .eq('unipile_account_id', account.unipile_account_id)
        .single();

      if (existing) {
        console.log(`  Already in workspace_accounts for ${membership.workspaces?.name}`);
        continue;
      }

      // Insert into workspace_accounts
      const { error: insertError } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: membership.workspace_id,
          user_id: account.user_id,
          account_type: 'linkedin',
          account_identifier: account.account_name?.toLowerCase().replace(/\s+/g, '-') || 'linkedin-account',
          account_name: account.account_name,
          unipile_account_id: account.unipile_account_id,
          connection_status: account.connection_status === 'active' ? 'connected' : account.connection_status,
          is_active: true,
          connected_at: new Date().toISOString()
        });

      if (insertError) {
        console.log(`  ❌ Failed to sync to ${membership.workspaces?.name}:`, insertError.message);
      } else {
        console.log(`  ✅ Synced to workspace_accounts for ${membership.workspaces?.name}`);
      }
    }
  }

  console.log('\n✅ Done!');
}

fix().catch(console.error);
