require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeCampaigns() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  
  console.log('\n📊 CAMPAIGN ANALYSIS\n');
  
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', '2025-11-06T00:00:00')
    .order('created_at', { ascending: false });
    
  for (const campaign of campaigns) {
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('id, status, contacted_at')
      .eq('campaign_id', campaign.id);
      
    const total = prospects ? prospects.length : 0;
    const contacted = prospects ? prospects.filter(p => p.contacted_at).length : 0;
    
    console.log('📋', campaign.name);
    console.log('   Created:', new Date(campaign.created_at).toLocaleString());
    console.log('   Prospects:', total);
    console.log('   Contacted:', contacted);
    
    if (total > 0) {
      const statuses = {};
      prospects.forEach(p => {
        statuses[p.status] = (statuses[p.status] || 0) + 1;
      });
      console.log('   Status breakdown:', JSON.stringify(statuses));
    }
    console.log('');
  }
}

analyzeCampaigns().catch(console.error);
