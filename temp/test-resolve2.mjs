import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Get a failed item with its campaign info
  const { data: failed } = await supabase
    .from('send_queue')
    .select(`
      id,
      linkedin_user_id,
      linkedin_account_id,
      campaign_id,
      campaigns (
        name,
        workspace_id,
        linkedin_account_id
      )
    `)
    .eq('status', 'failed')
    .limit(3);

  console.log('=== FAILED ITEMS WITH CAMPAIGN INFO ===');
  if (failed) {
    for (const f of failed) {
      console.log('---');
      console.log('Queue ID:', f.id.substring(0,8));
      console.log('linkedin_user_id:', f.linkedin_user_id);
      console.log('Queue linkedin_account_id:', f.linkedin_account_id);
      console.log('Campaign:', f.campaigns?.name);
      console.log('Campaign linkedin_account_id:', f.campaigns?.linkedin_account_id);
    }
  }

  // Check user_unipile_accounts
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, account_holder_name, status, platform')
    .eq('status', 'connected')
    .limit(10);

  console.log('\n=== CONNECTED ACCOUNTS ===');
  if (accounts) {
    accounts.forEach(a => {
      console.log(`  ${a.account_holder_name}: ${a.unipile_account_id} (${a.platform})`);
    });
  }
}

check().catch(console.error);
