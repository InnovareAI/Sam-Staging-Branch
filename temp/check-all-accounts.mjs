import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAllTables() {
  console.log('CHECKING ALL ACCOUNT-RELATED TABLES');
  console.log('='.repeat(60));

  // List of possible table names for accounts
  const tables = [
    'unified_accounts',
    'workspace_linkedin_accounts',
    'linkedin_accounts',
    'unipile_accounts',
    'workspace_integrations',
    'integrations',
    'connected_accounts',
    'accounts'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(10);

    if (!error && data) {
      console.log('\n✅ TABLE: ' + table);
      console.log('   Records: ' + data.length);
      if (data.length > 0) {
        console.log('   Columns: ' + Object.keys(data[0]).join(', '));
        console.log('   Sample:');
        for (const row of data.slice(0, 3)) {
          console.log('   - ' + JSON.stringify(row).substring(0, 200));
        }
      }
    }
  }

  // Also check workspaces
  console.log('\n\nWORKSPACES:');
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  for (const ws of workspaces || []) {
    console.log('   - ' + ws.name + ': ' + ws.id);
  }
}

checkAllTables().catch(console.error);
