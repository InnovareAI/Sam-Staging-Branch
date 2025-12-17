import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Get failed campaign info
  const campaignId = '22d6c138-98a4-4e0c-8c85-fbc4e2d76bdd'; // Consulting- Sequence A

  const { data: camp } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id, workspace_id')
    .eq('id', campaignId)
    .single();

  console.log('=== CAMPAIGN ===');
  console.log('Name:', camp.name);
  console.log('linkedin_account_id:', camp.linkedin_account_id);
  console.log('workspace_id:', camp.workspace_id);

  // Check workspace_accounts
  console.log('\n=== WORKSPACE_ACCOUNTS WITH THAT ID ===');
  const { data: wsAccById } = await supabase
    .from('workspace_accounts')
    .select('id, account_name, unipile_account_id')
    .eq('id', camp.linkedin_account_id);

  console.log('By ID:', wsAccById);

  // Check all accounts for this workspace
  console.log('\n=== ALL ACCOUNTS FOR WORKSPACE ===');
  const { data: wsAccs } = await supabase
    .from('workspace_accounts')
    .select('id, account_name, unipile_account_id, account_type')
    .eq('workspace_id', camp.workspace_id);

  if (wsAccs) {
    wsAccs.forEach(a => {
      console.log(`  ${a.id}: ${a.account_name} (${a.account_type}) - unipile: ${a.unipile_account_id}`);
    });
  }

  // Also check user_unipile_accounts (old table)
  console.log('\n=== user_unipile_accounts FOR WORKSPACE ===');
  const { data: uniAccs, error: uniErr } = await supabase
    .from('user_unipile_accounts')
    .select('id, unipile_account_id, platform, status')
    .eq('workspace_id', camp.workspace_id);

  if (uniErr) {
    console.log('Error:', uniErr.message);
  } else if (uniAccs) {
    uniAccs.forEach(a => {
      console.log(`  ${a.id}: ${a.unipile_account_id} (${a.platform}) - ${a.status}`);
    });
  }
}

check().catch(console.error);
