import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function checkSchema() {
  // Get workspace_accounts columns
  const { data: wa } = await supabase
    .from('workspace_accounts')
    .select('*')
    .limit(1);

  console.log('=== WORKSPACE_ACCOUNTS COLUMNS ===');
  if (wa && wa[0]) {
    console.log(Object.keys(wa[0]).join(', '));
  }

  // Get user_unipile_accounts columns
  const { data: ua } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .limit(1);

  console.log('\n=== USER_UNIPILE_ACCOUNTS COLUMNS ===');
  if (ua && ua[0]) {
    console.log(Object.keys(ua[0]).join(', '));
  }

  // Check current sync status
  const { data: uaAll } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name, unipile_account_id, workspace_id, connection_status');

  const { data: waAll } = await supabase
    .from('workspace_accounts')
    .select('id, account_name, unipile_account_id, workspace_id, connection_status');

  console.log('\n=== SYNC STATUS ===');
  console.log('user_unipile_accounts:', uaAll?.length || 0);
  console.log('workspace_accounts:', waAll?.length || 0);

  // Find missing from workspace_accounts
  const waIds = new Set(waAll?.map(w => w.unipile_account_id) || []);
  const missing = uaAll?.filter(u => !waIds.has(u.unipile_account_id)) || [];

  console.log('\nMissing from workspace_accounts:', missing.length);
  missing.forEach(m => {
    console.log('  -', m.account_name, '| WS:', m.workspace_id?.substring(0,8));
  });
}

checkSchema().catch(console.error);
