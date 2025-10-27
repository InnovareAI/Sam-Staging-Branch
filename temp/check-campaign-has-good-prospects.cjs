#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignHasGoodProspects() {
  console.log('🔍 Checking if Ben Shichman and Dr. De are in any campaign...\n');

  // Search for these prospects in campaign_prospects
  const { data: benProspect } = await supabase
    .from('campaign_prospects')
    .select('*, campaigns(name)')
    .or('first_name.eq.Ben,linkedin_url.eq.https://www.linkedin.com/in/benshichman')
    .limit(5);

  const { data: drDeProspect } = await supabase
    .from('campaign_prospects')
    .select('*, campaigns(name)')
    .or('first_name.eq.Dr.,linkedin_url.eq.https://www.linkedin.com/in/drmonyade')
    .limit(5);

  console.log('Ben Shichman prospects:', benProspect?.length || 0);
  benProspect?.forEach(p => {
    console.log(`  Campaign: ${p.campaigns?.name}`);
    console.log(`  Name: ${p.first_name} ${p.last_name}`);
    console.log(`  LinkedIn: ${p.linkedin_url || 'MISSING'}`);
    console.log(`  Status: ${p.status}`);
    console.log('');
  });

  console.log('Dr. De prospects:', drDeProspect?.length || 0);
  drDeProspect?.forEach(p => {
    console.log(`  Campaign: ${p.campaigns?.name}`);
    console.log(`  Name: ${p.first_name} ${p.last_name}`);
    console.log(`  LinkedIn: ${p.linkedin_url || 'MISSING'}`);
    console.log(`  Status: ${p.status}`);
    console.log('');
  });

  // Check what happened - are they still in approval data?
  console.log('\n🔍 Checking approval status...\n');

  const { data: approvalBen } = await supabase
    .from('prospect_approval_data')
    .select('*, prospect_approval_sessions(campaign_name)')
    .eq('name', 'Ben Shichman')
    .single();

  const { data: approvalDrDe } = await supabase
    .from('prospect_approval_data')
    .select('*, prospect_approval_sessions(campaign_name)')
    .ilike('name', 'Dr%De%')
    .single();

  if (approvalBen) {
    console.log('Ben Shichman in approval data:');
    console.log(`  Session: ${approvalBen.prospect_approval_sessions?.campaign_name}`);
    console.log(`  Status: ${approvalBen.approval_status}`);
    console.log(`  LinkedIn URL: ${approvalBen.contact?.linkedin_url}`);
  }

  if (approvalDrDe) {
    console.log('\nDr. De in approval data:');
    console.log(`  Session: ${approvalDrDe.prospect_approval_sessions?.campaign_name}`);
    console.log(`  Status: ${approvalDrDe.approval_status}`);
    console.log(`  LinkedIn URL: ${approvalDrDe.contact?.linkedin_url}`);
  }
}

checkCampaignHasGoodProspects().catch(console.error);
