#!/usr/bin/env node
/**
 * Debug IA7 workspace access issue
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7
const USER_EMAIL = 'tbslinz@icloud.com';

console.log('🔍 DEBUGGING IA7 WORKSPACE ACCESS...\n');

// 1. Get user
const { data: authUser } = await supabase.auth.admin.listUsers();
const user = authUser.users.find(u => u.email === USER_EMAIL);

if (!user) {
  console.error('❌ User not found:', USER_EMAIL);
  process.exit(1);
}

console.log('✅ User found:');
console.log('   ID:', user.id);
console.log('   Email:', user.email);
console.log('   Email confirmed:', user.email_confirmed_at ? 'Yes' : 'No');

// 2. Check workspace membership
const { data: members, error: membersError } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID)
  .eq('user_id', user.id);

console.log('\n👥 Workspace Membership:');
if (membersError) {
  console.error('❌ Error:', membersError.message);
} else if (!members || members.length === 0) {
  console.log('❌ Not a member of workspace');
} else {
  console.log('✅ Member found:');
  members.forEach(m => {
    console.log('   Role:', m.role);
    console.log('   Joined:', m.created_at);
  });
}

// 3. Check workspace exists
const { data: workspace, error: wsError } = await supabase
  .from('workspaces')
  .select('*')
  .eq('id', WORKSPACE_ID)
  .single();

console.log('\n🏢 Workspace Status:');
if (wsError) {
  console.error('❌ Error:', wsError.message);
} else {
  console.log('✅ Workspace found:');
  console.log('   Name:', workspace.name);
  console.log('   Owner ID:', workspace.owner_id);
  console.log('   Created:', workspace.created_at);
}

// 4. Get all workspaces user has access to
const { data: allMemberships } = await supabase
  .from('workspace_members')
  .select('workspace_id, role, workspaces(name)')
  .eq('user_id', user.id);

console.log('\n📋 All User Workspaces:');
if (!allMemberships || allMemberships.length === 0) {
  console.log('❌ User is not a member of ANY workspace');
  console.log('   This is likely the issue!');
} else {
  console.log(`✅ User has access to ${allMemberships.length} workspace(s):`);
  allMemberships.forEach(m => {
    console.log(`   - ${m.workspaces?.name || 'Unknown'} (${m.role})`);
  });
}

// 5. Check if user needs to be set as workspace owner instead
console.log('\n🔧 SUGGESTED FIX:');
if (workspace.owner_id !== user.id) {
  console.log('Option 1: Set user as workspace owner');
  console.log(`   UPDATE workspaces SET owner_id = '${user.id}' WHERE id = '${WORKSPACE_ID}';`);
}
console.log('\nOption 2: Ensure workspace_members record is correct');
console.log('   (Already done - verify RLS policies allow access)');
