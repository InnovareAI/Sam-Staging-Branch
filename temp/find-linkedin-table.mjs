import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function findLinkedInTable() {
  console.log('FINDING LINKEDIN ACCOUNTS TABLE');
  console.log('='.repeat(60));

  // Get a campaign's linkedin_account_id
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, linkedin_account_id')
    .not('linkedin_account_id', 'is', null)
    .limit(1)
    .single();

  if (campaign) {
    console.log('Sample campaign:');
    console.log('   Name: ' + campaign.name);
    console.log('   linkedin_account_id: ' + campaign.linkedin_account_id);

    // Try to find this ID in various tables
    const tablesToCheck = [
      'workspace_linkedin_accounts',
      'linkedin_profiles',
      'accounts',
      'user_accounts',
      'social_accounts',
      'external_accounts',
      'oauth_accounts',
      'provider_accounts'
    ];

    for (const table of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('id', campaign.linkedin_account_id)
          .single();

        if (!error && data) {
          console.log('\n✅ FOUND IN TABLE: ' + table);
          console.log('   Data: ' + JSON.stringify(data, null, 2));
        }
      } catch (e) {
        // Table doesn't exist
      }
    }
  }

  // Also try to query by workspace_id
  console.log('\n\nCHECKING WORKSPACE_LINKEDIN_ACCOUNTS BY WORKSPACE:');

  const { data: wsAccounts, error: wsError } = await supabase
    .from('workspace_linkedin_accounts')
    .select('*')
    .limit(20);

  if (!wsError && wsAccounts) {
    console.log('Found ' + wsAccounts.length + ' accounts');
    for (const a of wsAccounts) {
      console.log('\n   Account:');
      console.log('   ' + JSON.stringify(a, null, 2));
    }
  } else if (wsError) {
    console.log('Table error: ' + wsError.message);
  }

  // Check if there's a column reference
  console.log('\n\nCHECKING FOREIGN KEY REFERENCES:');
  const { data: fkData } = await supabase.rpc('get_table_columns', { table_name: 'campaigns' }).catch(() => ({ data: null }));
  if (fkData) {
    console.log('Campaigns columns: ' + JSON.stringify(fkData));
  }
}

findLinkedInTable().catch(console.error);
