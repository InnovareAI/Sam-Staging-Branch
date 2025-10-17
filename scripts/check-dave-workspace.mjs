#!/usr/bin/env node
/**
 * Check Dave's workspace assignment
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDaveWorkspace() {
  const email = 'dave.stuteville@sendingcell.com';
  
  console.log(`🔍 Checking workspace for ${email}...\n`);

  // Find user
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.email} (${user.id})\n`);

  // Check user profile
  const { data: profile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  console.log('📋 User Profile:');
  console.log('  current_workspace_id:', profile?.current_workspace_id || '❌ NOT SET');

  // Check workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', user.id);

  console.log('\n👥 Workspace Memberships:');
  if (memberships && memberships.length > 0) {
    memberships.forEach(m => {
      console.log(`  - ${m.workspaces?.name} (${m.workspace_id}) - ${m.role}`);
    });
  } else {
    console.log('  ❌ No workspace memberships found');
  }

  // If no current workspace but has memberships, set the first one
  if (!profile?.current_workspace_id && memberships && memberships.length > 0) {
    const workspaceId = memberships[0].workspace_id;
    console.log(`\n🔧 Setting current workspace to: ${memberships[0].workspaces?.name}`);
    
    const { error } = await supabase
      .from('users')
      .update({ current_workspace_id: workspaceId })
      .eq('id', user.id);

    if (error) {
      console.error('❌ Failed to update workspace:', error);
    } else {
      console.log('✅ Workspace updated successfully');
    }
  }
}

checkDaveWorkspace().catch(console.error);
