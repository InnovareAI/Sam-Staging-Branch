require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLatestProspect() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  
  console.log('\n🔍 CHECKING LATEST CAMPAIGN PROSPECT\n');
  
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1);
    
  const campaign = campaigns[0];
  console.log('📋 Campaign:', campaign.name);
  console.log('   ID:', campaign.id);
  console.log('   Created:', new Date(campaign.created_at).toLocaleString(), '\n');
  
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);
    
  console.log('📊 Prospects:', prospects.length, '\n');
  
  if (prospects.length > 0) {
    const p = prospects[0];
    console.log('✅ Prospect details:');
    console.log('   Name:', p.first_name, p.last_name);
    console.log('   Company:', p.company_name);
    console.log('   Title:', p.title);
    console.log('   LinkedIn URL:', p.linkedin_url);
    console.log('   LinkedIn ID:', p.linkedin_user_id || 'NOT SET (ok for messenger)');
    console.log('   Status:', p.status);
    console.log('   Ready to contact:', p.status === 'pending' || p.status === 'approved' ? '✅ YES' : '❌ NO');
  }
}

checkLatestProspect().catch(console.error);
