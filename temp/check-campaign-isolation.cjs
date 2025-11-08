require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaigns() {
  console.log('🔍 Checking campaign isolation issue...\n');

  const userEmail = 'tl@innovareai.com';
  const innovareWorkspace = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  console.log(`👤 User: ${user.email} (${user.id})\n`);

  // Get user's workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .eq('user_id', user.id);

  console.log('🏢 User Workspace Memberships:');
  if (memberships && memberships.length > 0) {
    memberships.forEach(m => {
      console.log(`   - ${m.workspaces?.name} (${m.workspace_id})`);
    });
  } else {
    console.log('   ❌ No workspace memberships found!');
  }

  // Get campaigns with "Charissa" in the name
  const { data: charissaCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, workspace_id, created_by, created_at')
    .ilike('name', '%charissa%');

  console.log('\n📊 Campaigns with "Charissa" in name:');
  if (charissaCampaigns && charissaCampaigns.length > 0) {
    charissaCampaigns.forEach(c => {
      console.log(`   Campaign: ${c.name}`);
      console.log(`   Workspace: ${c.workspace_id}`);
      console.log(`   Created by: ${c.created_by}`);
      console.log(`   Is InnovareAI workspace: ${c.workspace_id === innovareWorkspace ? 'YES ✅' : 'NO ❌'}`);
      console.log('');
    });
  }

  // Get all campaigns in InnovareAI workspace
  const { data: innovareCampaigns } = await supabase
    .from('campaigns')
    .select('id, name, created_by, created_at')
    .eq('workspace_id', innovareWorkspace)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\n📋 Recent campaigns in InnovareAI workspace:`);
  if (innovareCampaigns && innovareCampaigns.length > 0) {
    innovareCampaigns.forEach(c => {
      console.log(`   - ${c.name}`);
      console.log(`     Created by: ${c.created_by}`);
    });
  }
}

checkCampaigns().catch(console.error);
