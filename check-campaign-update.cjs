#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

async function checkCampaignUpdate() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const campaignName = '20251101-IAI-Outreach Campaign';

  console.log('🔍 Checking campaign prospects status update...\n');

  // Find the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .ilike('name', `%${campaignName}%`)
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log('Campaign:', campaign.name);
  console.log('ID:', campaign.id);
  console.log('');

  // Get prospect statuses
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, contacted_at, updated_at')
    .eq('campaign_id', campaign.id)
    .order('updated_at', { ascending: false });

  if (!prospects || prospects.length === 0) {
    console.log('❌ No prospects found');
    return;
  }

  console.log('📊 Prospect Status:');
  console.log('─'.repeat(70));
  prospects.forEach(p => {
    const statusIcon = p.contacted_at ? '✅' : '⏳';
    console.log(`${statusIcon} ${p.first_name} ${p.last_name}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   Contacted: ${p.contacted_at || 'No'}`);
    console.log(`   Updated: ${p.updated_at}`);
    console.log('');
  });

  // Check if any status changed in last 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recentUpdates = prospects.filter(p => p.updated_at > tenMinutesAgo);

  console.log('\n' + '='.repeat(70));
  if (recentUpdates.length > 0) {
    console.log('✅ Recent updates (last 10 minutes):');
    recentUpdates.forEach(p => {
      console.log(`   - ${p.first_name} ${p.last_name}: ${p.status}`);
    });
  } else {
    console.log('⚠️  No prospect updates in last 10 minutes');
    console.log('   This suggests campaign activation did NOT trigger workflow');
  }
  console.log('='.repeat(70));
}

checkCampaignUpdate().catch(console.error);
