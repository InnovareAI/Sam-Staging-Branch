import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// All LinkedIn accounts from Unipile API (status: OK)
const LINKEDIN_ACCOUNTS = [
  { name: 'Charissa Saniel', workspace_id: '7f0341da-88db-476b-ae0a-fc0da5b70861', unipile_id: '4nt1J-blSnGUPBjH2Nfjpg', linkedin_id: '𝗖𝗵𝗮𝗿𝗶𝘀𝘀𝗮-𝗦𝗮𝗻𝗶𝗲𝗹-054978232' },
  { name: 'Rony Chatterjee', workspace_id: '8a720935-db68-43e2-b16d-34383ec6c3e8', unipile_id: 'I0XZxvzfSRuCL8nuFoUEuw', linkedin_id: 'rony-chatterjee-phd-b2488912' },
  { name: 'Chona Lamberte', workspace_id: '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', unipile_id: 'Ll1T0gRVTYmLM6kqN1cJcg', linkedin_id: 'chonam-lamberte-54b87437b' },
  { name: 'Brian Neirby', workspace_id: 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7', unipile_id: 'RFrEaJZOSGieognCTW0V6w', linkedin_id: 'brianneirby' },
  { name: 'Michelle Gestuveo', workspace_id: '04666209-fce8-4d71-8eaf-01278edfc73b', unipile_id: 'aroiwOeQQo2S8_-FqLjzNw', linkedin_id: 'michellegestuveo' },
  { name: 'Samantha Truman', workspace_id: 'dea5a7f2-673c-4429-972d-6ba5fca473fb', unipile_id: 'fntPg3vJTZ2Z1MP4rISntg', linkedin_id: 'samanthatruman' },
  { name: 'Thorsten Linz', workspace_id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009', unipile_id: 'mERQmojtSZq5GeomZZazlw', linkedin_id: 'tvonlinz', status: 'CREDENTIALS' }, // Needs reauth
  { name: 'Stan Bounev', workspace_id: '5b81ee67-4d41-4997-b5a4-e1432e060d12', unipile_id: 'nGqBWgDmTkqnoMGA3Hbc9w', linkedin_id: 'stanbounev' },
  { name: 'Irish Maguad', workspace_id: '96c03b38-a2f4-40de-9e16-43098599e1d4', unipile_id: 'ymtTx4xVQ6OVUFk83ctwtA', linkedin_id: 'irish-maguad-202737171' },
];

async function fixAllAccounts() {
  console.log('CHECKING AND FIXING ALL LINKEDIN ACCOUNTS');
  console.log('='.repeat(60));

  // 1. Get all existing workspace_accounts for LinkedIn
  const { data: existing } = await supabase
    .from('workspace_accounts')
    .select('id, workspace_id, account_name, unipile_account_id, connection_status, is_active, account_type')
    .eq('account_type', 'linkedin');

  console.log('\n1. EXISTING LINKEDIN ACCOUNTS:');
  for (const acc of existing || []) {
    console.log('   - ' + acc.account_name + ' (' + acc.connection_status + ')');
    console.log('     Workspace: ' + acc.workspace_id);
    console.log('     Unipile: ' + acc.unipile_account_id);
  }

  const existingWorkspaces = new Set((existing || []).map(a => a.workspace_id));

  // 2. Check each expected account
  console.log('\n\n2. CHECKING FOR MISSING/INCORRECT ACCOUNTS:');

  for (const expected of LINKEDIN_ACCOUNTS) {
    const existingAcc = (existing || []).find(a => a.workspace_id === expected.workspace_id);

    if (!existingAcc) {
      console.log('\n   ❌ MISSING: ' + expected.name);
      console.log('      Adding...');

      // Get a user_id for this workspace
      const { data: member } = await supabase
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', expected.workspace_id)
        .limit(1)
        .single();

      if (!member) {
        console.log('      ⚠️  No workspace member found, skipping');
        continue;
      }

      const { error: insertError } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: expected.workspace_id,
          user_id: member.user_id,
          account_type: 'linkedin',
          account_identifier: expected.name,
          account_name: expected.name,
          unipile_account_id: expected.unipile_id,
          connection_status: expected.status === 'CREDENTIALS' ? 'needs_reauth' : 'connected',
          is_active: expected.status !== 'CREDENTIALS',
          unipile_sources: [{ id: expected.unipile_id + '_MESSAGING', status: 'OK' }],
          daily_message_limit: 20,
          messages_sent_today: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.log('      Insert error: ' + insertError.message);
      } else {
        console.log('      ✅ ADDED');
      }
    } else if (existingAcc.unipile_account_id !== expected.unipile_id) {
      console.log('\n   ⚠️  MISMATCH: ' + expected.name);
      console.log('      DB has: ' + existingAcc.unipile_account_id);
      console.log('      Should be: ' + expected.unipile_id);
      console.log('      Updating...');

      const { error: updateError } = await supabase
        .from('workspace_accounts')
        .update({
          unipile_account_id: expected.unipile_id,
          connection_status: expected.status === 'CREDENTIALS' ? 'needs_reauth' : 'connected',
          is_active: expected.status !== 'CREDENTIALS',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAcc.id);

      if (updateError) {
        console.log('      Update error: ' + updateError.message);
      } else {
        console.log('      ✅ UPDATED');
      }
    } else {
      console.log('   ✅ OK: ' + expected.name);
    }
  }

  // 3. Final verification
  console.log('\n\n3. FINAL ACCOUNT STATUS:');
  const { data: final } = await supabase
    .from('workspace_accounts')
    .select('workspace_id, account_name, unipile_account_id, connection_status, is_active')
    .eq('account_type', 'linkedin')
    .order('account_name');

  for (const acc of final || []) {
    const status = acc.is_active && acc.connection_status === 'connected' ? '✅' : '⚠️';
    console.log('   ' + status + ' ' + acc.account_name);
    console.log('      Status: ' + acc.connection_status + ', Active: ' + acc.is_active);
  }

  console.log('\n' + '='.repeat(60));
  console.log('DONE - All LinkedIn accounts verified/fixed');
}

fixAllAccounts().catch(console.error);
