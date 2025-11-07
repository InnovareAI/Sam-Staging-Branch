require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserWorkspace() {
  console.log('🔍 Checking user workspace configuration...\n');

  const userEmail = 'tl@innovareai.com';

  // Get user from auth
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`✅ User: ${user.email}`);
  console.log(`   ID: ${user.id}\n`);

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  console.log('📋 User Profile:');
  console.log(`   current_workspace_id: ${profile?.current_workspace_id || 'NULL'}`);

  // Get workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .eq('user_id', user.id);

  console.log('\n🏢 Workspace Memberships:');
  if (memberships && memberships.length > 0) {
    memberships.forEach(m => {
      const isCurrent = m.workspace_id === profile?.current_workspace_id;
      console.log(`   ${isCurrent ? '→' : ' '} ${m.workspace_id} - ${m.workspaces?.name || 'Unknown'}`);
    });
  }

  // Get sessions for this user in the InnovareAI workspace
  const innovareWorkspace = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
  const { data: sessions } = await supabase
    .from('prospect_approval_sessions')
    .select('id, campaign_name, created_at, total_prospects')
    .eq('workspace_id', innovareWorkspace)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log(`\n📊 Sessions in InnovareAI Workspace (${innovareWorkspace}):`);
  console.log(`   Filtering by: workspace_id AND user_id AND status='active'`);
  console.log(`   Found: ${sessions?.length || 0} sessions`);

  if (sessions && sessions.length > 0) {
    sessions.forEach(s => {
      console.log(`   - ${s.campaign_name} (${s.total_prospects} prospects)`);
    });
  }

  // Check what sessions/list API would return
  console.log('\n🔍 What /api/prospect-approval/sessions/list would query:');

  if (profile?.current_workspace_id) {
    console.log(`   1. Use current_workspace_id: ${profile.current_workspace_id}`);

    const { data: profileSessions } = await supabase
      .from('prospect_approval_sessions')
      .select('id, campaign_name, created_at')
      .eq('workspace_id', profile.current_workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3);

    console.log(`   Found: ${profileSessions?.length || 0} sessions\n`);
  } else {
    console.log(`   ⚠️ No current_workspace_id set - would use first membership`);
  }
}

checkUserWorkspace().catch(console.error);
