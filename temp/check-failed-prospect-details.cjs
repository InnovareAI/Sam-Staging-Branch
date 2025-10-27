#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFailedProspect() {
  console.log('🔍 Checking failed prospect details...\n');

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

  console.log(`📋 Campaign: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}\n`);

  // Get all prospects, ordered by most recent update
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .order('updated_at', { ascending: false });

  console.log(`Found ${prospects?.length || 0} prospects:\n`);

  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name || '(no name)'} ${p.last_name || ''}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Updated: ${p.updated_at}`);
    console.log(`   Contacted: ${p.contacted_at || '(never)'}`);

    if (p.personalization_data) {
      console.log(`   Personalization data:`, JSON.stringify(p.personalization_data, null, 2));
    }

    console.log('');
  });

  // Check which user's account would be used
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === 'tl@innovareai.com');

  if (user) {
    console.log(`\n👤 User: ${user.email}`);
    console.log(`   ID: ${user.id}\n`);

    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', campaign.workspace_id)
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    if (account) {
      console.log(`📱 LinkedIn Account that SHOULD be used:`);
      console.log(`   Name: ${account.account_name}`);
      console.log(`   Base Account ID: ${account.unipile_account_id}`);
      console.log(`   Sources:`, account.unipile_sources);
    } else {
      console.log(`❌ No connected LinkedIn account found for user`);
    }
  }
}

checkFailedProspect().catch(console.error);
