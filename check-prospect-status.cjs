#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

async function checkProspectsStatus() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('🔍 Checking Prospect Status Across All Campaigns');
  console.log('=================================================\n');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false });

  if (!campaigns) {
    console.log('No campaigns found');
    return;
  }

  let hasReadyProspects = false;

  for (const campaign of campaigns) {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, status, contacted_at, linkedin_url, email')
      .eq('campaign_id', campaign.id);

    if (!prospects || prospects.length === 0) continue;

    const notContacted = prospects.filter(p => !p.contacted_at);
    const contacted = prospects.filter(p => p.contacted_at);
    const pendingReady = prospects.filter(p =>
      ['pending', 'queued_in_n8n'].includes(p.status) &&
      !p.contacted_at &&
      (p.linkedin_url || p.email)
    );

    console.log(`📋 ${campaign.name}`);
    console.log(`   Campaign Status: ${campaign.status}`);
    console.log(`   Total Prospects: ${prospects.length}`);
    console.log(`   Not Contacted Yet: ${notContacted.length}`);
    console.log(`   Already Contacted: ${contacted.length}`);
    console.log(`   ✅ READY for execution: ${pendingReady.length}`);

    if (pendingReady.length > 0) {
      hasReadyProspects = true;
      console.log('   Ready prospects:');
      pendingReady.forEach(p => {
        console.log(`      ✅ ${p.first_name} ${p.last_name} (${p.status})`);
        console.log(`         LinkedIn: ${p.linkedin_url ? 'Yes' : 'No'} | Email: ${p.email ? 'Yes' : 'No'}`);
      });
    } else if (notContacted.length > 0) {
      console.log('   ⚠️  Not contacted but needs status update:');
      notContacted.slice(0, 3).forEach(p => {
        console.log(`      ${p.first_name} ${p.last_name} (current: ${p.status})`);
      });
    } else if (contacted.length > 0) {
      console.log('   ℹ️  All prospects already contacted');
    }
    console.log('');
  }

  console.log('\n' + '='.repeat(70));
  if (hasReadyProspects) {
    console.log('✅ You have campaigns with prospects ready to execute!');
    console.log('   Just activate the campaign with ready prospects.');
  } else {
    console.log('⚠️  NO campaigns have prospects ready for execution');
    console.log('\n💡 SOLUTIONS:');
    console.log('─'.repeat(70));
    console.log('1. Reset test prospects (reset contacted_at to NULL)');
    console.log('2. Add NEW prospects to "20251102-IAI-Outreach Campaign"');
    console.log('3. Create a new campaign with fresh prospects\n');
    console.log('Would you like me to:');
    console.log('  A) Reset prospects in a test campaign? (run: node check-prospect-status.cjs reset)');
    console.log('  B) Show you how to add prospects via UI?');
  }
  console.log('='.repeat(70));

  // If 'reset' argument, reset test campaign prospects
  if (process.argv.includes('reset')) {
    console.log('\n🔄 Resetting test campaign prospects...\n');

    // Find a test campaign
    const testCampaign = campaigns.find(c => c.name.includes('test'));
    if (testCampaign) {
      const { data: updated } = await supabase
        .from('campaign_prospects')
        .update({
          contacted_at: null,
          status: 'pending',
          responded_at: null
        })
        .eq('campaign_id', testCampaign.id)
        .select();

      console.log(`✅ Reset ${updated?.length || 0} prospects in "${testCampaign.name}"`);
      console.log('   Status: pending');
      console.log('   contacted_at: NULL');
      console.log('\n🎯 Now try activating this campaign again!\n');
    } else {
      console.log('❌ No test campaign found to reset');
    }
  }
}

checkProspectsStatus().catch(console.error);
