const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function removeWorkspaceMemberships() {
  try {
    // First, get user ID for tl@innovareai.com
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === 'tl@innovareai.com');

    if (!user) {
      console.log('❌ User tl@innovareai.com not found');
      return;
    }

    console.log('✅ Found user:', user.id);

    // Get all workspace memberships
    const { data: memberships, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, status')
      .eq('user_id', user.id);

    if (memberError) {
      console.error('❌ Error fetching memberships:', memberError);
      return;
    }

    // Get workspace names separately
    const workspaceIds = memberships.map(m => m.workspace_id);
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .in('id', workspaceIds);

    if (workspaceError) {
      console.error('❌ Error fetching workspaces:', workspaceError);
      return;
    }

    // Merge membership and workspace data
    const membershipData = memberships.map(m => {
      const workspace = workspaces.find(w => w.id === m.workspace_id);
      return {
        ...m,
        workspace_name: workspace?.name || 'Unknown'
      };
    });

    console.log('\n📋 Current workspace memberships:');
    membershipData.forEach(m => {
      console.log(`  - ${m.workspace_name} (role: ${m.role}, status: ${m.status})`);
    });

    // Find workspaces to remove from
    const workspacesToRemove = membershipData.filter(m =>
      ['BLL', 'Sendingcell', 'True People', 'SendingCell', 'TruePeople'].some(name =>
        m.workspace_name.toLowerCase().includes(name.toLowerCase())
      )
    );

    console.log('\n🗑️  Removing from these workspaces:');
    workspacesToRemove.forEach(m => {
      console.log(`  - ${m.workspace_name}`);
    });

    // Remove memberships
    for (const membership of workspacesToRemove) {
      const { error: deleteError } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', membership.workspace_id)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error(`❌ Error removing from ${membership.workspace_name}:`, deleteError);
      } else {
        console.log(`✅ Removed from ${membership.workspace_name}`);
      }
    }

    console.log('\n✅ Done!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

removeWorkspaceMemberships();
