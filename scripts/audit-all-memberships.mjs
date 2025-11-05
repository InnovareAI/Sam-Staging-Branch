// Comprehensive audit of all workspaces and memberships
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditMemberships() {
  console.log('🔍 COMPREHENSIVE WORKSPACE & MEMBERSHIP AUDIT\n');
  console.log('='.repeat(80));

  // 1. Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });

  console.log(`\n📊 TOTAL WORKSPACES: ${workspaces?.length || 0}\n`);

  // 2. Get all workspace members
  const { data: allMemberships } = await supabase
    .from('workspace_members')
    .select('*')
    .order('joined_at', { ascending: false });

  console.log(`📊 TOTAL WORKSPACE MEMBERSHIPS: ${allMemberships?.length || 0}\n`);
  console.log('='.repeat(80));

  // 3. Get all users (from auth.users via service role)
  const { data: users } = await supabase
    .from('users')
    .select('id, email, created_at')
    .order('created_at', { ascending: false });

  console.log(`\n👥 TOTAL USERS: ${users?.length || 0}\n`);

  // 4. Analyze each workspace
  console.log('='.repeat(80));
  console.log('\n📋 WORKSPACE DETAILS:\n');

  for (const workspace of workspaces || []) {
    const members = allMemberships?.filter(m => m.workspace_id === workspace.id) || [];

    console.log(`\n🏢 ${workspace.name}`);
    console.log(`   ID: ${workspace.id}`);
    console.log(`   Created: ${workspace.created_at}`);
    console.log(`   Members: ${members.length}`);

    if (members.length === 0) {
      console.log('   ⚠️  WARNING: NO MEMBERS!');
    } else {
      members.forEach((m, i) => {
        const user = users?.find(u => u.id === m.user_id);
        console.log(`   ${i + 1}. ${user?.email || 'Unknown user'} (${m.role}) - joined ${m.joined_at}`);
      });
    }
  }

  // 5. Find users without workspace memberships
  console.log('\n' + '='.repeat(80));
  console.log('\n👤 USERS WITHOUT WORKSPACE MEMBERSHIPS:\n');

  const usersWithoutWorkspace = users?.filter(user => {
    return !allMemberships?.some(m => m.user_id === user.id);
  }) || [];

  if (usersWithoutWorkspace.length === 0) {
    console.log('   ✅ All users have at least one workspace membership');
  } else {
    console.log(`   ⚠️  Found ${usersWithoutWorkspace.length} user(s) without workspaces:\n`);
    usersWithoutWorkspace.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email} (${user.id})`);
      console.log(`      Created: ${user.created_at}`);
    });
  }

  // 6. Find workspaces without members
  console.log('\n' + '='.repeat(80));
  console.log('\n🏢 WORKSPACES WITHOUT MEMBERS:\n');

  const workspacesWithoutMembers = workspaces?.filter(workspace => {
    return !allMemberships?.some(m => m.workspace_id === workspace.id);
  }) || [];

  if (workspacesWithoutMembers.length === 0) {
    console.log('   ✅ All workspaces have at least one member');
  } else {
    console.log(`   ⚠️  Found ${workspacesWithoutMembers.length} workspace(s) without members:\n`);
    workspacesWithoutMembers.forEach((workspace, i) => {
      console.log(`   ${i + 1}. ${workspace.name} (${workspace.id})`);
      console.log(`      Created: ${workspace.created_at}`);
    });
  }

  // 7. Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SUMMARY:\n');
  console.log(`   Workspaces: ${workspaces?.length || 0}`);
  console.log(`   Users: ${users?.length || 0}`);
  console.log(`   Total memberships: ${allMemberships?.length || 0}`);
  console.log(`   Orphaned users: ${usersWithoutWorkspace.length}`);
  console.log(`   Empty workspaces: ${workspacesWithoutMembers.length}`);

  // Calculate average
  const avgMembersPerWorkspace = workspaces?.length > 0
    ? (allMemberships?.length || 0) / workspaces.length
    : 0;
  console.log(`   Avg members per workspace: ${avgMembersPerWorkspace.toFixed(2)}`);

  console.log('\n' + '='.repeat(80));
}

auditMemberships().catch(console.error);
