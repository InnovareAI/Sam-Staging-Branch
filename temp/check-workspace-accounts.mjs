import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTable() {
  console.log('CHECKING WORKSPACE_ACCOUNTS TABLE');
  console.log('='.repeat(60));

  // Try to get all rows without filter
  const { data, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .limit(5);

  if (error) {
    console.log('Error: ' + error.message);
    console.log('Code: ' + error.code);

    // Check if table exists at all
    if (error.message.includes('does not exist')) {
      console.log('\n❌ TABLE DOES NOT EXIST');
      console.log('Need to create the workspace_accounts table');
    }
  } else {
    console.log('Table exists! Found ' + (data?.length || 0) + ' rows');
    if (data && data.length > 0) {
      console.log('Columns: ' + Object.keys(data[0]).join(', '));
      console.log('\nSample data:');
      for (const row of data) {
        console.log(JSON.stringify(row, null, 2));
      }
    }
  }

  // Also check what other similar tables exist
  console.log('\n\nCHECKING SIMILAR TABLES:');

  const tables = [
    'workspace_accounts',
    'accounts',
    'linkedin_accounts',
    'oauth_accounts',
    'connected_accounts',
    'provider_accounts',
    'workspace_connections'
  ];

  for (const table of tables) {
    const { data: tData, error: tError } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (!tError) {
      console.log('   ✅ ' + table + ' exists');
      if (tData && tData.length > 0) {
        console.log('      Columns: ' + Object.keys(tData[0]).join(', '));
      }
    }
  }
}

checkTable().catch(console.error);
