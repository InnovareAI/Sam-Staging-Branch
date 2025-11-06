require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAdminToWorkspace() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b'; // tl@innovareai.com
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08'; // Blue Label Labs
  
  console.log('\n🔧 Adding admin to workspace...\n');
  console.log(`User: f6885ff3-deef-4781-8721-93011c990b1b (tl@innovareai.com)`);
  console.log(`Workspace: 014509ba-226e-43ee-ba58-ab5f20d2ed08 (Blue Label Labs)`);
  console.log(`Role: admin\n`);
  
  const { data, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: 'admin',
      status: 'active',
      joined_at: new Date().toISOString()
    })
    .select();
    
  if (error) {
    console.error('❌ Error adding admin:', error);
    return;
  }
  
  console.log('✅ Successfully added admin to workspace:');
  console.log(JSON.stringify(data, null, 2));
  
  // Verify membership
  const { data: members } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId);
    
  console.log('\n📋 All workspace members now:');
  console.log(JSON.stringify(members, null, 2));
}

addAdminToWorkspace().catch(console.error);
