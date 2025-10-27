#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkCampaignAndProspects() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🔍 Checking Campaign and Prospects...\n');

  // Get the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', 'ac81022c-48f4-4f06-87be-1467175f5b61')
    .single();

  console.log('📋 Campaign Details:');
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Name: ${campaign.name}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Workspace: ${campaign.workspace_id}`);
  console.log('');

  // Get prospects for this campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .order('created_at', { ascending: false });

  console.log(`📊 Found ${prospects.length} prospects:\n`);

  prospects.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   LinkedIn: ${p.linkedin_url || 'MISSING!'}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Contacted: ${p.contacted_at || 'Never'}`);
    console.log(`   Campaign Name (in data): ${p.personalization_data?.campaign_name || 'MISSING!'}`);
    console.log('');
  });

  // Check if there's an approval session
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('campaign_name', campaign.name)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`🗂️  Found ${sessions?.length || 0} approval sessions for this campaign:`);
  if (sessions && sessions.length > 0) {
    sessions.forEach((s, i) => {
      console.log(`   ${i + 1}. Session ID: ${s.id}`);
      console.log(`      Campaign Name: ${s.campaign_name || 'MISSING!'}`);
      console.log(`      Created: ${s.created_at}`);
    });
  }
}

checkCampaignAndProspects().catch(console.error);
