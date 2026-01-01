/**
 * Fix All Users' Workspace IDs
 *
 * Ensures every user has current_workspace_id set.
 * Sets it to their first workspace from workspace_members.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

async function fixAllUserWorkspaces() {
  console.log('🔍 Finding users without workspace IDs...\n');

  // Get all users
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id');

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    process.exit(1);
  }

  console.log(`📊 Total users: ${allUsers?.length || 0}`);

  // Filter users without workspace ID
  const usersWithoutWorkspace = allUsers?.filter(u => !u.current_workspace_id) || [];

  console.log(`⚠️  Users missing workspace ID: ${usersWithoutWorkspace.length}\n`);

  if (usersWithoutWorkspace.length === 0) {
    console.log('✅ All users already have workspace IDs set!');
    return;
  }

  let fixed = 0;
  let failed = 0;

  for (const user of usersWithoutWorkspace) {
    console.log(`🔧 Fixing user: ${user.email} (${user.id})`);

    // Get user's first workspace from workspace_members
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(`   ❌ Error fetching workspace for ${user.email}:`, membershipError.message);
      failed++;
      continue;
    }

    if (!membership?.workspace_id) {
      console.log(`   ⚠️  No workspace membership found for ${user.email}`);
      failed++;
      continue;
    }

    // Update user's current_workspace_id
    const { error: updateError } = await supabase
      .from('users')
      .update({ current_workspace_id: membership.workspace_id })
      .eq('id', user.id);

    if (updateError) {
      console.error(`   ❌ Failed to update ${user.email}:`, updateError.message);
      failed++;
      continue;
    }

    const workspaceName = (membership as any).workspaces?.name || 'Unknown';
    console.log(`   ✅ Set workspace: ${workspaceName} (${membership.workspace_id})`);
    fixed++;
  }

  console.log('\n📊 Results:');
  console.log(`   ✅ Fixed: ${fixed} users`);
  console.log(`   ❌ Failed: ${failed} users`);
  console.log(`   📈 Total: ${usersWithoutWorkspace.length} users processed`);
}

// Run the fix
fixAllUserWorkspaces()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
