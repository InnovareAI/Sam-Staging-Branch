#!/usr/bin/env node
/**
 * Assign user to a workspace if they don't have one
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';

async function assignWorkspace() {
  console.log(`🔍 Checking user ${userId}...\n`);

  // Get user details
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  console.log(`📧 User email: ${user?.email}`);
  console.log(`🏢 Current workspace: ${user?.current_workspace_id || 'NULL'}\n`);

  // Get workspaces the user is a member of
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', userId);

  console.log(`Found ${memberships?.length || 0} workspace memberships:`);
  memberships?.forEach(m => {
    console.log(`  - ${m.workspace_id}: ${m.workspaces?.name} (${m.role})`);
  });

  if (memberships && memberships.length > 0 && !user?.current_workspace_id) {
    const workspaceId = memberships[0].workspace_id;
    console.log(`\n✅ Assigning user to workspace: ${workspaceId}`);
    
    const { error } = await supabase
      .from('users')
      .update({ current_workspace_id: workspaceId })
      .eq('id', userId);

    if (error) {
      console.error('❌ Failed to update user:', error);
    } else {
      console.log('✅ User workspace updated successfully');
    }
  }
}

assignWorkspace().catch(console.error);
