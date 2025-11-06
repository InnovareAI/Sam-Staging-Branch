require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRecentCampaigns() {
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  
  console.log('\n🔍 RECENT CAMPAIGNS\n');
  
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, created_at, created_by')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(5);
    
  campaigns.forEach((c, i) => {
    console.log((i + 1) + '.', c.name);
    console.log('   ID:', c.id);
    console.log('   Created:', c.created_at);
    console.log('   Workspace:', c.workspace_id);
    console.log('');
  });
}

checkRecentCampaigns().catch(console.error);
