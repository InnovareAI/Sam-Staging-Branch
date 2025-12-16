import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Unipile DSN and API Key from production
const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';

// Mappings from Unipile API response
const WORKSPACE_LINKEDIN_MAPPINGS = [
  { name: 'Charissa Saniel', workspace_id: '7f0341da-88db-476b-ae0a-fc0da5b70861', unipile_id: '4nt1J-blSnGUPBjH2Nfjpg' },
  { name: 'Rony Chatterjee', workspace_id: '8a720935-db68-43e2-b16d-34383ec6c3e8', unipile_id: 'I0XZxvzfSRuCL8nuFoUEuw' },
  { name: 'Chona Lamberte', workspace_id: '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', unipile_id: 'Ll1T0gRVTYmLM6kqN1cJcg' },
  { name: 'Brian Neirby', workspace_id: 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7', unipile_id: 'RFrEaJZOSGieognCTW0V6w' },
  { name: 'Michelle Gestuveo', workspace_id: '04666209-fce8-4d71-8eaf-01278edfc73b', unipile_id: 'aroiwOeQQo2S8_-FqLjzNw' },
  { name: 'Samantha Truman', workspace_id: 'dea5a7f2-673c-4429-972d-6ba5fca473fb', unipile_id: 'fntPg3vJTZ2Z1MP4rISntg' },
  { name: 'Thorsten Linz', workspace_id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009', unipile_id: 'mERQmojtSZq5GeomZZazlw' },
  { name: 'Stan Bounev', workspace_id: '5b81ee67-4d41-4997-b5a4-e1432e060d12', unipile_id: 'nGqBWgDmTkqnoMGA3Hbc9w' },
  { name: 'Irish Maguad', workspace_id: '96c03b38-a2f4-40de-9e16-43098599e1d4', unipile_id: 'ymtTx4xVQ6OVUFk83ctwtA' },
];

async function fixAllAccounts() {
  console.log('CHECKING AND FIXING ALL WORKSPACE ACCOUNTS');
  console.log('='.repeat(60));

  // 1. Check existing workspace_accounts
  console.log('\n1. CURRENT WORKSPACE_ACCOUNTS:');
  const { data: existing, error: existingError } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('provider', 'linkedin');

  if (existingError) {
    console.log('   Error: ' + existingError.message);
    if (existingError.message.includes('does not exist')) {
      console.log('   Table does not exist - need to create it!');
    }
    return;
  }

  console.log('   Found ' + (existing?.length || 0) + ' LinkedIn accounts');
  for (const acc of existing || []) {
    console.log('\n   - ' + acc.unipile_account_id);
    console.log('     Workspace: ' + acc.workspace_id);
    console.log('     Status: ' + acc.status);
  }

  // 2. Find missing workspaces
  console.log('\n\n2. CHECKING FOR MISSING ACCOUNTS...');

  const existingWorkspaces = new Set((existing || []).map(a => a.workspace_id));

  for (const mapping of WORKSPACE_LINKEDIN_MAPPINGS) {
    if (existingWorkspaces.has(mapping.workspace_id)) {
      console.log('   ✅ ' + mapping.name + ' - already exists');
    } else {
      console.log('   ❌ ' + mapping.name + ' - MISSING');

      // Add the account
      const { error: insertError } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: mapping.workspace_id,
          provider: 'linkedin',
          unipile_account_id: mapping.unipile_id,
          unipile_dsn: UNIPILE_DSN,
          unipile_api_key: UNIPILE_API_KEY,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.log('      Insert error: ' + insertError.message);
      } else {
        console.log('      ✅ ADDED');
      }
    }
  }

  // 3. Verify all accounts
  console.log('\n\n3. FINAL VERIFICATION:');
  const { data: final } = await supabase
    .from('workspace_accounts')
    .select('workspace_id, unipile_account_id, status')
    .eq('provider', 'linkedin')
    .eq('status', 'active');

  console.log('   Total active LinkedIn accounts: ' + (final?.length || 0));
  for (const acc of final || []) {
    const mapping = WORKSPACE_LINKEDIN_MAPPINGS.find(m => m.workspace_id === acc.workspace_id);
    console.log('   - ' + (mapping?.name || acc.workspace_id) + ': ' + acc.unipile_account_id);
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
}

fixAllAccounts().catch(console.error);
