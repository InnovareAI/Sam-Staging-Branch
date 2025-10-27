#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function traceHowCampaignWasCreated() {
  console.log('🔍 Finding how campaign "20251026-IAI-test 15" was created...\n');

  // Get the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, campaign_prospects(*)')
    .eq('name', '20251026-IAI-test 15')
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log(`Campaign: ${campaign.name}`);
  console.log(`  Created: ${campaign.created_at}`);
  console.log(`  Total prospects: ${campaign.campaign_prospects?.length}\n`);

  // Get session with matching campaign name
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('campaign_name', '20251026-IAI-test 15')
    .single();

  if (session) {
    console.log(`Found matching approval session:`);
    console.log(`  Session ID: ${session.id}`);
    console.log(`  Approved count: ${session.approved_count}`);
    console.log(`  Total prospects: ${session.total_prospects}`);
    console.log(`  Status: ${session.status}\n`);
  }

  // Show what happened to the 2 empty prospects
  console.log('Campaign prospects data:');
  campaign.campaign_prospects?.forEach((p, i) => {
    console.log(`\n${i + 1}. Prospect ${p.id}:`);
    console.log(`   Name: ${p.first_name || '(none)'} ${p.last_name || '(none)'}`);
    console.log(`   Company: ${p.company_name}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
    console.log(`   Created: ${p.created_at}`);
    console.log(`   Source: ${p.personalization_data?.source || 'unknown'}`);
  });

  // Check if there's a database function that creates prospects
  console.log('\n🔍 Checking database functions...');
  const { data: functions } = await supabase.rpc('help');
  console.log(functions);
}

traceHowCampaignWasCreated().catch(console.error);
