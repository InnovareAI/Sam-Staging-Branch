require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTeamWorkspaces() {
  console.log('🔍 Checking for team workspaces vs individual workspaces...\n');

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .order('name');

  console.log('📊 WORKSPACE MEMBERSHIP ANALYSIS:\n');

  let teamWorkspaces = [];
  let individualWorkspaces = [];
  let emptyWorkspaces = [];

  for (const workspace of workspaces) {
    // Count members in each workspace
    const { data: members, count } = await supabase
      .from('workspace_members')
      .select('user_id, role, users(email)', { count: 'exact' })
      .eq('workspace_id', workspace.id);

    const memberCount = count || 0;

    if (memberCount === 0) {
      emptyWorkspaces.push({ ...workspace, memberCount });
      console.log(`❌ ${workspace.name}`);
      console.log(`   Members: 0 (EMPTY - NO MEMBERS)`);
    } else if (memberCount === 1) {
      individualWorkspaces.push({ ...workspace, memberCount, members });
      console.log(`👤 ${workspace.name}`);
      console.log(`   Members: 1 (Individual)`);
      console.log(`   User: ${members[0]?.users?.email || 'Unknown'} (${members[0]?.role})`);
    } else {
      teamWorkspaces.push({ ...workspace, memberCount, members });
      console.log(`👥 ${workspace.name}`);
      console.log(`   Members: ${memberCount} (TEAM WORKSPACE)`);
      members.forEach(m => {
        console.log(`   - ${m.users?.email || 'Unknown'} (${m.role})`);
      });
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════\n');
  console.log('📈 SUMMARY:');
  console.log(`   Team Workspaces (2+ members): ${teamWorkspaces.length}`);
  console.log(`   Individual Workspaces (1 member): ${individualWorkspaces.length}`);
  console.log(`   Empty Workspaces (0 members): ${emptyWorkspaces.length}`);
  console.log('');

  if (teamWorkspaces.length > 0) {
    console.log('⚠️  TEAM WORKSPACES STILL EXIST:');
    teamWorkspaces.forEach(w => {
      console.log(`   - ${w.name} (${w.memberCount} members)`);
    });
  } else {
    console.log('✅ NO TEAM WORKSPACES FOUND - All workspaces are individual');
  }

  if (emptyWorkspaces.length > 0) {
    console.log('\n❌ EMPTY WORKSPACES (Need cleanup):');
    emptyWorkspaces.forEach(w => {
      console.log(`   - ${w.name} (ID: ${w.id})`);
    });
  }
}

checkTeamWorkspaces().catch(console.error);
