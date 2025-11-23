#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProspects() {
  const campaignId = '105c036b-797d-4ca7-862c-309518fa72ef';
  
  console.log('\n🔍 CHECKING FAILED PROSPECTS\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`Found ${prospects.length} prospects:\n`);

  prospects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   ├─ Status: ${p.status}`);
    console.log(`   ├─ LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
    console.log(`   ├─ LinkedIn User ID: ${p.linkedin_user_id || 'MISSING'}`);
    console.log(`   ├─ Added by: ${p.added_by_unipile_account || 'MISSING'}`);
    console.log(`   ├─ Error: ${p.error_message || 'None'}`);
    console.log(`   ├─ Notes: ${p.notes || 'None'}`);
    console.log(`   └─ Created: ${new Date(p.created_at).toLocaleString()}\n`);
  });

  // Check campaign details
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  console.log('Campaign Details:');
  console.log(`├─ Status: ${campaign.status}`);
  console.log(`├─ Type: ${campaign.campaign_type}`);
  console.log(`├─ LinkedIn Account ID: ${campaign.linkedin_account_id || 'MISSING'}`);
  console.log(`└─ Workspace ID: ${campaign.workspace_id}\n`);

  // Check if LinkedIn account exists
  if (campaign.linkedin_account_id) {
    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('id', campaign.linkedin_account_id)
      .single();

    if (account) {
      console.log('LinkedIn Account:');
      console.log(`├─ Name: ${account.account_name}`);
      console.log(`├─ Unipile Account ID: ${account.unipile_account_id}`);
      console.log(`├─ Connection Status: ${account.connection_status}`);
      console.log(`└─ Is Active: ${account.is_active}\n`);
    }
  } else {
    console.log('⚠️  No LinkedIn account assigned to campaign\n');
  }
}

checkProspects();
