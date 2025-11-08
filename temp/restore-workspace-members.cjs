require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function restoreWorkspaceMembers() {
  console.log('🔧 Restoring workspace memberships...\n');

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  console.log(`Found ${users.length} users in system\n`);

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('name');

  console.log(`Found ${workspaces.length} workspaces\n`);

  // Get users table data to see current_workspace_id
  const { data: userProfiles } = await supabase
    .from('users')
    .select('id, email, current_workspace_id');

  console.log('👥 USER → WORKSPACE MAPPING:\n');

  const membershipsToCreate = [];

  for (const user of users) {
    const profile = userProfiles.find(p => p.id === user.id);

    console.log(`User: ${user.email}`);
    console.log(`  Auth ID: ${user.id}`);
    console.log(`  Current Workspace ID: ${profile?.current_workspace_id || 'NOT SET'}`);

    if (profile?.current_workspace_id) {
      const workspace = workspaces.find(w => w.id === profile.current_workspace_id);
      console.log(`  Workspace: ${workspace?.name || 'UNKNOWN'}`);

      membershipsToCreate.push({
        workspace_id: profile.current_workspace_id,
        user_id: user.id,
        email: user.email,
        workspace_name: workspace?.name || 'Unknown'
      });
    } else {
      console.log(`  ⚠️  No workspace assigned`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════\n');
  console.log(`📝 Will create ${membershipsToCreate.length} workspace memberships\n`);

  // Create memberships
  let created = 0;
  let errors = 0;

  for (const membership of membershipsToCreate) {
    console.log(`Adding ${membership.email} to ${membership.workspace_name}...`);

    const { data, error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: membership.workspace_id,
        user_id: membership.user_id,
        role: 'admin',
        invited_by: membership.user_id,
        invitation_status: 'accepted'
      })
      .select()
      .single();

    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errors++;
    } else {
      console.log(`  ✅ Created`);
      created++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════\n');
  console.log('📊 RESULTS:');
  console.log(`  ✅ Created: ${created}`);
  console.log(`  ❌ Errors: ${errors}`);

  // Verify
  console.log('\n🔍 VERIFICATION:\n');

  for (const workspace of workspaces) {
    const { data: members, count } = await supabase
      .from('workspace_members')
      .select('user_id, users(email)', { count: 'exact' })
      .eq('workspace_id', workspace.id);

    console.log(`${workspace.name}: ${count || 0} member(s)`);
    if (members && members.length > 0) {
      members.forEach(m => {
        console.log(`  - ${m.users?.email || 'Unknown'}`);
      });
    }
  }
}

restoreWorkspaceMembers().catch(console.error);
