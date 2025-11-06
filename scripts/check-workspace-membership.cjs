require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMembership() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  
  console.log('\n🔍 Checking workspace membership...\n');
  
  // Check workspace_members
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId);
    
  console.log('📋 All workspace_members for this workspace:');
  console.log(JSON.stringify(members, null, 2));
  if (membersError) console.log('Error:', membersError);
  
  // Check if user has ANY memberships
  const { data: userMemberships, error: userError } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', userId);
    
  console.log('\n📋 All workspace memberships for user:');
  console.log(JSON.stringify(userMemberships, null, 2));
  if (userError) console.log('Error:', userError);
  
  // Check workspace details
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
    
  console.log('\n🏢 Workspace details:');
  console.log(JSON.stringify(workspace, null, 2));
  if (workspaceError) console.log('Error:', workspaceError);
}

checkMembership().catch(console.error);
