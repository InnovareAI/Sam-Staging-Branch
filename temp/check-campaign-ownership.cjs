const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Checking campaign ownership...\n');

  // Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, created_by, status')
    .order('created_at', { ascending: false })
    .limit(20);

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name');

  console.log('📊 RECENT CAMPAIGNS:\n');

  campaigns.forEach(c => {
    const ws = workspaces.find(w => w.id === c.workspace_id);
    const creator = users.find(u => u.id === c.created_by);

    console.log(`Campaign: ${c.name}`);
    console.log(`  Workspace: ${ws?.name || 'Unknown'} (${c.workspace_id})`);
    console.log(`  Created by: ${creator?.email || 'Unknown'}`);
    console.log(`  Status: ${c.status}`);
    console.log('');
  });

  // Check specifically for Charissa's campaigns
  console.log('═══════════════════════════════════════════════════\n');
  console.log('CHARISSA\'S CAMPAIGNS:\n');

  const charissa = users.find(u => u.email === 'cs@innovareai.com');
  if (charissa) {
    const charissaCampaigns = campaigns.filter(c => c.created_by === charissa.id);
    console.log(`Found ${charissaCampaigns.length} campaigns created by cs@innovareai.com\n`);

    charissaCampaigns.forEach(c => {
      const ws = workspaces.find(w => w.id === c.workspace_id);
      console.log(`  - ${c.name}`);
      console.log(`    Workspace: ${ws?.name}`);
      console.log(`    Is InnovareAI: ${c.workspace_id === 'babdcab8-1a78-4b2f-913e-6e9fd9821009' ? 'YES' : 'NO'}`);
    });
  }

  // Check YOUR campaigns
  console.log('\n═══════════════════════════════════════════════════\n');
  console.log('YOUR CAMPAIGNS (tl@innovareai.com):\n');

  const you = users.find(u => u.email === 'tl@innovareai.com');
  if (you) {
    const yourCampaigns = campaigns.filter(c => c.created_by === you.id);
    console.log(`Found ${yourCampaigns.length} campaigns created by tl@innovareai.com\n`);

    yourCampaigns.forEach(c => {
      const ws = workspaces.find(w => w.id === c.workspace_id);
      console.log(`  - ${c.name}`);
      console.log(`    Workspace: ${ws?.name}`);
    });
  }
})();
