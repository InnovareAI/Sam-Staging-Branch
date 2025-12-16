import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Unipile account mappings from API
const UNIPILE_ACCOUNTS = {
  'Charissa Saniel': { workspace: '7f0341da-88db-476b-ae0a-fc0da5b70861', unipile_id: '4nt1J-blSnGUPBjH2Nfjpg' },
  'Rony Chatterjee': { workspace: '8a720935-db68-43e2-b16d-34383ec6c3e8', unipile_id: 'I0XZxvzfSRuCL8nuFoUEuw' },
  'Chona Lamberte': { workspace: '2a8f7c3d-9b1e-4f6a-8c2d-5e9a1b4f7d3c', unipile_id: 'Ll1T0gRVTYmLM6kqN1cJcg' },
  'Brian Neirby': { workspace: 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7', unipile_id: 'RFrEaJZOSGieognCTW0V6w' },
  'Michelle Gestuveo': { workspace: '04666209-fce8-4d71-8eaf-01278edfc73b', unipile_id: 'aroiwOeQQo2S8_-FqLjzNw' },
  'Samantha Truman': { workspace: 'dea5a7f2-673c-4429-972d-6ba5fca473fb', unipile_id: 'fntPg3vJTZ2Z1MP4rISntg' },
  'Thorsten Linz': { workspace: 'babdcab8-1a78-4b2f-913e-6e9fd9821009', unipile_id: 'mERQmojtSZq5GeomZZazlw' },
  'Stan Bounev': { workspace: '5b81ee67-4d41-4997-b5a4-e1432e060d12', unipile_id: 'nGqBWgDmTkqnoMGA3Hbc9w' },
  'Irish Maguad': { workspace: '96c03b38-a2f4-40de-9e16-43098599e1d4', unipile_id: 'ymtTx4xVQ6OVUFk83ctwtA' },
  'Jennifer Fleming': { workspace: 'cd57981a-e63b-401c-bde1-ac71752c2293', unipile_id: 'rV0czB_nTLC8KSRb69_zRg' }, // Email account
};

async function findAndFixMappings() {
  console.log('FINDING AND FIXING ACCOUNT MAPPINGS');
  console.log('='.repeat(60));

  // 1. Check what tables reference unipile_account_id
  console.log('\n1. CHECKING TABLES FOR UNIPILE MAPPINGS...');

  // Check campaigns table
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, workspace_id, linkedin_account_id, name')
    .not('linkedin_account_id', 'is', null)
    .limit(10);

  if (campaigns && campaigns.length > 0) {
    console.log('\n   campaigns table has linkedin_account_id:');
    for (const c of campaigns) {
      console.log('   - ' + c.name + ': ' + c.linkedin_account_id);
    }
  }

  // Check linkedin_brand_guidelines
  const { data: guidelines } = await supabase
    .from('linkedin_brand_guidelines')
    .select('workspace_id, unipile_account_id, linkedin_account_id')
    .limit(20);

  if (guidelines && guidelines.length > 0) {
    console.log('\n   linkedin_brand_guidelines:');
    for (const g of guidelines) {
      console.log('   - Workspace: ' + g.workspace_id);
      console.log('     unipile_account_id: ' + (g.unipile_account_id || 'NULL'));
      console.log('     linkedin_account_id: ' + (g.linkedin_account_id || 'NULL'));
    }
  }

  // Check linkedin_post_monitors
  const { data: monitors } = await supabase
    .from('linkedin_post_monitors')
    .select('id, workspace_id, name, metadata')
    .limit(10);

  if (monitors && monitors.length > 0) {
    console.log('\n   linkedin_post_monitors metadata:');
    for (const m of monitors.slice(0, 3)) {
      const meta = m.metadata || {};
      if (meta.unipile_account_id || meta.linkedin_account_id) {
        console.log('   - ' + m.name + ': ' + JSON.stringify(meta));
      }
    }
  }

  // 2. Update Brian's brand guidelines with his Unipile ID
  console.log('\n\n2. UPDATING BRIAN\'S LINKEDIN ACCOUNT...');

  const brianUnipileId = 'RFrEaJZOSGieognCTW0V6w';
  const brianWorkspace = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

  const { data: updated, error: updateError } = await supabase
    .from('linkedin_brand_guidelines')
    .update({
      unipile_account_id: brianUnipileId,
      linkedin_account_id: brianUnipileId
    })
    .eq('workspace_id', brianWorkspace)
    .select();

  if (updateError) {
    console.log('   Error updating brand guidelines: ' + updateError.message);
    console.log('   Columns may not exist, checking schema...');

    // Get the actual columns
    const { data: sample } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', brianWorkspace)
      .single();

    if (sample) {
      console.log('   Existing columns: ' + Object.keys(sample).join(', '));
    }
  } else {
    console.log('   ✅ Updated Brian\'s brand guidelines with Unipile ID');
  }

  // 3. Check/update monitors
  console.log('\n\n3. UPDATING BRIAN\'S MONITORS...');

  const { data: brianMonitors } = await supabase
    .from('linkedin_post_monitors')
    .select('id, name, metadata')
    .eq('workspace_id', brianWorkspace);

  for (const m of brianMonitors || []) {
    const meta = m.metadata || {};
    meta.unipile_account_id = brianUnipileId;
    meta.linkedin_account_id = brianUnipileId;

    await supabase
      .from('linkedin_post_monitors')
      .update({ metadata: meta })
      .eq('id', m.id);

    console.log('   ✅ Updated monitor: ' + m.name);
  }

  console.log('\n' + '='.repeat(60));
  console.log('BRIAN\'S ACCOUNT MAPPING COMPLETE');
  console.log('Unipile ID: ' + brianUnipileId);
}

findAndFixMappings().catch(console.error);
