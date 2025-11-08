require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyWorkspaces() {
  console.log('🔍 Verifying workspace data...\n');

  const userEmail = 'tl@innovareai.com';

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  console.log(`👤 User: ${user.email} (${user.id})\n`);

  // Get ALL workspaces in the system
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });

  console.log('🏢 ALL WORKSPACES IN SYSTEM:');
  if (allWorkspaces && allWorkspaces.length > 0) {
    allWorkspaces.forEach((w, i) => {
      console.log(`   ${i + 1}. ${w.name}`);
      console.log(`      ID: ${w.id}`);
      console.log(`      Created: ${w.created_at}`);
      console.log('');
    });
  }

  // Get user's memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', user.id);

  console.log('👥 YOUR WORKSPACE MEMBERSHIPS:');
  if (memberships && memberships.length > 0) {
    memberships.forEach(m => {
      console.log(`   - ${m.workspaces?.name} (${m.role})`);
      console.log(`     Workspace ID: ${m.workspace_id}`);
    });
  } else {
    console.log('   ❌ No memberships found');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  console.log('\n📝 USER PROFILE:');
  console.log(`   Current Workspace ID: ${profile?.current_workspace_id || 'NOT SET'}`);
}

verifyWorkspaces().catch(console.error);
