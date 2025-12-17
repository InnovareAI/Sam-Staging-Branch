import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  console.log('=== ASSIGNING CORRECT LINKEDIN ACCOUNTS TO CAMPAIGNS ===\n');

  // Get all campaigns with NULL linkedin_account_id
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, linkedin_account_id, status');

  // Get all accounts with workspace
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, workspace_id, account_name, connection_status');

  // Build workspace -> account mapping (prefer active accounts)
  const workspaceToAccount = {};
  for (const acc of (accounts || [])) {
    if (acc.workspace_id && acc.connection_status === 'active') {
      workspaceToAccount[acc.workspace_id] = { id: acc.id, name: acc.account_name };
    }
  }

  console.log('Available accounts by workspace:');
  for (const [wsId, acc] of Object.entries(workspaceToAccount)) {
    console.log(`  ${wsId.substring(0, 8)}... -> ${acc.name}`);
  }

  console.log('\nFixing campaigns:\n');

  let fixed = 0;
  let noAccount = 0;

  for (const camp of (campaigns || [])) {
    if (!camp.linkedin_account_id) {
      const account = workspaceToAccount[camp.workspace_id];

      if (account) {
        const { error } = await supabase
          .from('campaigns')
          .update({ linkedin_account_id: account.id })
          .eq('id', camp.id);

        if (error) {
          console.log(`❌ ${camp.name}: ${error.message}`);
        } else {
          console.log(`✅ ${camp.name} -> ${account.name}`);
          fixed++;
        }
      } else {
        console.log(`⚠️  ${camp.name}: No account for workspace (${camp.status})`);
        noAccount++;
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`No account available: ${noAccount}`);
}

fix().catch(console.error);
