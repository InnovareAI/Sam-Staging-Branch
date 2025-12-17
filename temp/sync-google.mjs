import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function sync() {
  const { data: ua } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('unipile_account_id', 'nefy7jYjS5K6X3U7ORxHNQ')
    .single();

  if (!ua) {
    console.log('Account not found');
    return;
  }

  // Map GOOGLE_OAUTH to email
  const accountType = ua.platform === 'GOOGLE_OAUTH' ? 'email' : ua.platform.toLowerCase();

  console.log('Syncing:', ua.account_name);
  console.log('  Platform:', ua.platform, '->', accountType);

  const { error } = await supabase
    .from('workspace_accounts')
    .upsert({
      id: ua.id,
      workspace_id: ua.workspace_id,
      user_id: ua.user_id,
      account_type: accountType,
      account_identifier: ua.account_email || ua.unipile_account_id,
      account_name: ua.account_name,
      unipile_account_id: ua.unipile_account_id,
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

  // Verify
  const { count } = await supabase
    .from('workspace_accounts')
    .select('*', { count: 'exact', head: true });

  console.log('\nworkspace_accounts count now:', count);
}

sync().catch(console.error);
