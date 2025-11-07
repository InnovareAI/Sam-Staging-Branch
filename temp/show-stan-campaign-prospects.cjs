require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function showCampaignProspects() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('🔍 STAN\'S CAMPAIGN PROSPECTS\n');
  console.log('=' .repeat(70));

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, company, title, status, linkedin_url, campaign_id')
    .eq('workspace_id', workspaceId)
    .order('status')
    .order('last_name');

  if (!prospects || prospects.length === 0) {
    console.log('\n❌ No campaign prospects found\n');
    return;
  }

  console.log(`\n📊 Total: ${prospects.length} prospects\n`);

  // Status breakdown
  const statuses = {};
  prospects.forEach(p => {
    statuses[p.status] = (statuses[p.status] || 0) + 1;
  });

  console.log('STATUS BREAKDOWN:');
  Object.entries(statuses).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\n' + '=' .repeat(70));

  // Get campaign names
  const campaignIds = [...new Set(prospects.map(p => p.campaign_id))];
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .in('id', campaignIds);

  const campaignMap = {};
  campaigns?.forEach(c => {
    campaignMap[c.id] = c.name;
  });

  console.log(`\n📋 CAMPAIGNS:`);
  Object.entries(campaignMap).forEach(([id, name]) => {
    const count = prospects.filter(p => p.campaign_id === id).length;
    console.log(`  - ${name} (${count} prospects)`);
  });

  console.log('\n' + '=' .repeat(70));
  console.log('\n✅ ALL PROSPECTS:\n');

  prospects.forEach((p, i) => {
    const linkedin = p.linkedin_url ? '✅' : '❌';
    const campaign = campaignMap[p.campaign_id] || 'Unknown';

    console.log(`${String(i + 1).padStart(2, ' ')}. ${p.first_name} ${p.last_name} ${linkedin}`);
    console.log(`    Status: ${p.status}`);
    console.log(`    Title: ${p.title || 'N/A'}`);
    console.log(`    Company: ${p.company || 'N/A'}`);
    console.log(`    Campaign: ${campaign}`);
    console.log('');
  });

  console.log('=' .repeat(70) + '\n');
}

showCampaignProspects().catch(console.error);
