#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseCampaignExecution() {
  console.log('🔍 Diagnosing campaign "20251027-IAI-Outreach Campaign"...\n');

  // Get the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('name', '20251027-IAI-Outreach Campaign')
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log(`Campaign ID: ${campaign.id}`);
  console.log(`Workspace ID: ${campaign.workspace_id}\n`);

  // Get prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);

  console.log(`Found ${prospects?.length || 0} prospects:\n`);

  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name || '(NO NAME)'} ${p.last_name || ''}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || '❌ MISSING'}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   LinkedIn ID: ${p.linkedin_user_id || '(none)'}`);
  });

  // Get LinkedIn account for this workspace
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('account_type', 'linkedin');

  console.log(`\n📱 LinkedIn Accounts for workspace:`);

  if (!accounts || accounts.length === 0) {
    console.log('❌ NO LINKEDIN ACCOUNTS FOUND!');
    console.log('   User needs to connect a LinkedIn account');
    return;
  }

  accounts.forEach((acc, i) => {
    console.log(`\n${i + 1}. Account ${acc.id}:`);
    console.log(`   Base Account ID: ${acc.unipile_account_id}`);
    console.log(`   Is Active: ${acc.is_active}`);
    console.log(`   Sources:`, acc.unipile_sources);

    // Check if there's an active source
    if (acc.unipile_sources && acc.unipile_sources.length > 0) {
      const activeSource = acc.unipile_sources.find(s => s.status === 'ACTIVE' || s.status === 'CONNECTED');
      if (activeSource) {
        console.log(`   ✅ Active Source ID: ${activeSource.id}`);
        console.log(`      Status: ${activeSource.status}`);
      } else {
        console.log(`   ❌ NO ACTIVE SOURCE!`);
        console.log(`      Available sources:`, acc.unipile_sources.map(s => `${s.id} (${s.status})`).join(', '));
      }
    } else {
      console.log(`   ❌ NO SOURCES AT ALL!`);
    }
  });

  // Check workspace members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', campaign.workspace_id);

  console.log(`\n👥 Workspace Members:`);
  members?.forEach((m, i) => {
    console.log(`   ${i + 1}. User ${m.user_id} (${m.role})`);
  });
}

diagnoseCampaignExecution().catch(console.error);
