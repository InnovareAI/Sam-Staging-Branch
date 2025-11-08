const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkApprovalData() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('              CHECKING PROSPECT APPROVAL SCREEN DATA                    ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Check prospect_approval_data table
  console.log('1. Checking prospect_approval_data table...\n');

  const { data: approvalData, error: approvalError } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (approvalError) {
    console.log(`❌ Error: ${approvalError.message}\n`);
  } else {
    console.log(`Total records in prospect_approval_data: ${approvalData?.length || 0}`);
    if (approvalData && approvalData.length > 0) {
      console.log('\nMost recent 5 records:');
      approvalData.forEach((item, idx) => {
        console.log(`\n${idx + 1}. ID: ${item.id}`);
        console.log(`   Status: ${item.status}`);
        console.log(`   Created: ${item.created_at}`);
        console.log(`   Prospect data keys: ${Object.keys(item.prospect_data || {}).join(', ')}`);
      });
    } else {
      console.log('⚠️  No records found in prospect_approval_data table');
    }
  }

  console.log('\n───────────────────────────────────────────────────────────────────────\n');

  // Check campaign_prospects table
  console.log('2. Checking campaign_prospects table...\n');

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('workspace_id', wsId)
    .eq('name', '20251106-BLL-CISO Outreach - Mid Market')
    .single();

  if (campaign) {
    console.log(`Campaign found: ${campaign.name}`);
    console.log(`Campaign ID: ${campaign.id}\n`);

    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaign.id);

    if (prospectsError) {
      console.log(`❌ Error: ${prospectsError.message}\n`);
    } else {
      console.log(`Total prospects in campaign: ${prospects?.length || 0}`);

      if (prospects && prospects.length > 0) {
        // Show status breakdown
        const statusCounts = {};
        prospects.forEach(p => {
          statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        });

        console.log('\nStatus breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
          console.log(`  ${status}: ${count}`);
        });

        console.log('\nFirst 5 prospects:');
        prospects.slice(0, 5).forEach((p, idx) => {
          console.log(`\n${idx + 1}. ${p.first_name} ${p.last_name || ''}`);
          console.log(`   Status: ${p.status}`);
          console.log(`   LinkedIn: ${p.linkedin_url ? 'Yes' : 'No'}`);
          console.log(`   Has personalization: ${p.personalization_data ? 'Yes' : 'No'}`);
        });
      }
    }
  } else {
    console.log('⚠️  Campaign not found');
  }

  console.log('\n───────────────────────────────────────────────────────────────────────\n');

  // Check workspace_prospects table
  console.log('3. Checking workspace_prospects table...\n');

  const { data: workspaceProspects, error: wpError } = await supabase
    .from('workspace_prospects')
    .select('*')
    .eq('workspace_id', wsId)
    .limit(5);

  if (wpError) {
    console.log(`❌ Error: ${wpError.message}\n`);
  } else {
    console.log(`Total records in workspace_prospects: ${workspaceProspects?.length || 0}`);
    if (workspaceProspects && workspaceProspects.length > 0) {
      console.log('\nFirst 5 records:');
      workspaceProspects.forEach((p, idx) => {
        console.log(`\n${idx + 1}. ${p.first_name} ${p.last_name || ''}`);
        console.log(`   Email: ${p.email || 'N/A'}`);
        console.log(`   LinkedIn: ${p.linkedin_url ? 'Yes' : 'No'}`);
      });
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                              SUMMARY                                   ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`prospect_approval_data: ${approvalData?.length || 0} records`);
  console.log(`campaign_prospects: ${prospects?.length || 0} records`);
  console.log(`workspace_prospects: ${workspaceProspects?.length || 0} records`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

checkApprovalData().catch(console.error);
