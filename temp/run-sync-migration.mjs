import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function runMigration() {
  console.log('=== STEP 1: Sync missing accounts manually ===');

  // Get accounts missing from workspace_accounts
  const { data: uaAll } = await supabase
    .from('user_unipile_accounts')
    .select('*');

  const { data: waAll } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id');

  const waIds = new Set(waAll?.map(w => w.unipile_account_id) || []);
  const missing = uaAll?.filter(u => !waIds.has(u.unipile_account_id)) || [];

  console.log('Missing accounts:', missing.length);

  for (const ua of missing) {
    console.log('Syncing:', ua.account_name);

    const { error } = await supabase
      .from('workspace_accounts')
      .upsert({
        id: ua.id,
        workspace_id: ua.workspace_id,
        user_id: ua.user_id,
        account_type: (ua.platform || 'linkedin').toLowerCase(),
        account_identifier: ua.account_email || ua.linkedin_public_identifier || ua.unipile_account_id,
        account_name: ua.account_name,
        unipile_account_id: ua.unipile_account_id,
        platform_account_id: ua.linkedin_public_identifier,
        connection_status: ua.connection_status === 'active' ? 'connected' : (ua.connection_status || 'connected'),
        connected_at: ua.created_at,
        is_active: ['active', 'connected'].includes(ua.connection_status),
        created_at: ua.created_at,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.log('  Error:', error.message);
    } else {
      console.log('  Synced!');
    }
  }

  console.log('\n=== STEP 2: Verify sync ===');

  const { data: uaFinal } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id');

  const { data: waFinal } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id');

  const waFinalIds = new Set(waFinal?.map(w => w.unipile_account_id) || []);
  const stillMissing = uaFinal?.filter(u => !waFinalIds.has(u.unipile_account_id)) || [];

  console.log('user_unipile_accounts:', uaFinal?.length || 0);
  console.log('workspace_accounts:', waFinal?.length || 0);
  console.log('Still missing:', stillMissing.length);

  if (stillMissing.length === 0) {
    console.log('\n✅ SUCCESS: All accounts synced!');
  } else {
    console.log('\n❌ Still have missing accounts:', stillMissing);
  }

  console.log('\n=== NOTE ===');
  console.log('The database trigger must be created via Supabase SQL Editor.');
  console.log('Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
  console.log('And run the SQL from: sql/migrations/058-sync-accounts-trigger.sql');
}

runMigration().catch(console.error);
