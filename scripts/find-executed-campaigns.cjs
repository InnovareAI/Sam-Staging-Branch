require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findExecutedCampaigns() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  
  console.log('\n🔍 FINDING EXECUTED CAMPAIGNS\n');
  
  // Find campaigns with contacted prospects
  const { data: contactedProspects } = await supabase
    .from('campaign_prospects')
    .select('campaign_id, contacted_at')
    .eq('workspace_id', workspaceId)
    .not('contacted_at', 'is', null)
    .order('contacted_at', { ascending: false })
    .limit(10);
    
  if (!contactedProspects || contactedProspects.length === 0) {
    console.log('❌ No contacted prospects found in InnovareAI workspace');
    console.log('\nThis means n8n has never successfully executed any campaigns.');
    return;
  }
  
  // Get unique campaign IDs
  const campaignIds = [...new Set(contactedProspects.map(p => p.campaign_id))];
  
  console.log('Found', contactedProspects.length, 'contacted prospects across', campaignIds.length, 'campaigns\n');
  
  // Get campaign details
  for (const campaignId of campaignIds.slice(0, 5)) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('name, created_at, status, n8n_workflow_id')
      .eq('id', campaignId)
      .single();
      
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('campaign_id', campaignId)
      .not('contacted_at', 'is', null);
      
    console.log('📋', campaign.name);
    console.log('   Created:', new Date(campaign.created_at).toLocaleString());
    console.log('   Status:', campaign.status);
    console.log('   Contacted:', prospects.length, 'prospects');
    console.log('   N8N Workflow:', campaign.n8n_workflow_id || 'NOT SET');
    console.log('');
  }
}

findExecutedCampaigns().catch(console.error);
