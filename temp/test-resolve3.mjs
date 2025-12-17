import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Get a failed item
  const { data: failed, error: failedErr } = await supabase
    .from('send_queue')
    .select('*')
    .eq('status', 'failed')
    .limit(3);

  console.log('Failed query error:', failedErr);
  console.log('Failed items count:', failed?.length || 0);

  if (failed && failed.length > 0) {
    const f = failed[0];
    console.log('\n=== FIRST FAILED ITEM ===');
    console.log('Queue ID:', f.id);
    console.log('linkedin_user_id:', f.linkedin_user_id);
    console.log('linkedin_account_id:', f.linkedin_account_id);
    console.log('campaign_id:', f.campaign_id);

    // Get campaign separately
    if (f.campaign_id) {
      const { data: camp } = await supabase
        .from('campaigns')
        .select('name, linkedin_account_id, workspace_id')
        .eq('id', f.campaign_id)
        .single();
      console.log('\nCampaign:', camp?.name);
      console.log('Campaign linkedin_account_id:', camp?.linkedin_account_id);
    }
  }

  // Check user_unipile_accounts
  const { data: accounts, error: accErr } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, account_holder_name, status, platform')
    .limit(10);

  console.log('\n=== ALL ACCOUNTS (first 10) ===');
  console.log('Account query error:', accErr);
  console.log('Accounts count:', accounts?.length || 0);
  if (accounts) {
    accounts.forEach(a => {
      console.log(`  ${a.account_holder_name}: ${a.unipile_account_id} (${a.platform}, ${a.status})`);
    });
  }
}

check().catch(console.error);
