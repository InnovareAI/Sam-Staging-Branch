require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignProspects() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  
  console.log('\n🔍 CHECKING CAMPAIGN PROSPECTS\n');
  
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (!campaigns || campaigns.length === 0) {
    console.log('❌ No campaigns found');
    return;
  }
  
  const campaign = campaigns[0];
  console.log('📋 Most recent campaign:', campaign.name);
  console.log('   ID:', campaign.id);
  console.log('   Created:', campaign.created_at, '\n');
  
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, linkedin_url, contacted_at')
    .eq('campaign_id', campaign.id);
    
  const prospectCount = prospects ? prospects.length : 0;
  console.log('📊 Total prospects:', prospectCount, '\n');
  
  if (prospectCount === 0) {
    console.log('⚠️  NO PROSPECTS IN CAMPAIGN!\n');
    return;
  }
  
  const statusCounts = {};
  prospects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });
  
  console.log('Status breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log('  -', status + ':', count);
  });
  
  console.log('\nSample prospects:');
  prospects.slice(0, 3).forEach(p => {
    console.log('  -', p.first_name, p.last_name, '(' + p.status + ')');
    console.log('    LinkedIn:', p.linkedin_url || 'MISSING');
  });
}

checkCampaignProspects().catch(console.error);
