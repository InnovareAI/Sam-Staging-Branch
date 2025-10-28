import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const email = process.argv[2] || 'tl+bll@innovareai.com';
const workspaceName = process.argv[3] || 'Blue Label Labs';

console.log(`🔍 Checking access for: ${email}`);
console.log(`🏢 Workspace: ${workspaceName}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Find user
const { data: users } = await supabase
  .from('users')
  .select('id, email')
  .eq('email', email);

if (!users || users.length === 0) {
  console.log(`❌ User not found: ${email}`);
  process.exit(0);
}

const user = users[0];
console.log(`✅ User found: ${user.email}`);
console.log(`   User ID: ${user.id}\n`);

// Find workspace
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name, client_code')
  .ilike('name', `%${workspaceName}%`);

if (!workspaces || workspaces.length === 0) {
  console.log(`❌ Workspace not found: ${workspaceName}`);
  process.exit(0);
}

const workspace = workspaces[0];
console.log(`✅ Workspace found: ${workspace.name}`);
console.log(`   Workspace ID: ${workspace.id}\n`);

// Check membership
const { data: membership } = await supabase
  .from('workspace_members')
  .select('*')
  .eq('workspace_id', workspace.id)
  .eq('user_id', user.id)
  .single();

if (!membership) {
  console.log('❌ User is NOT a member of this workspace\n');
  console.log('To add user to workspace, run:');
  console.log(`INSERT INTO workspace_members (workspace_id, user_id, role)`);
  console.log(`VALUES ('${workspace.id}', '${user.id}', 'admin');`);
} else {
  console.log(`✅ User IS a member of this workspace`);
  console.log(`   Role: ${membership.role}`);
  console.log(`   Joined: ${new Date(membership.created_at).toLocaleDateString()}`);
}

// Show all workspaces user has access to
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📋 All workspaces for ${email}:`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const { data: allMemberships } = await supabase
  .from('workspace_members')
  .select('role, workspaces(id, name, client_code)')
  .eq('user_id', user.id);

if (!allMemberships || allMemberships.length === 0) {
  console.log('No workspace memberships found');
} else {
  allMemberships.forEach((m, i) => {
    console.log(`${i + 1}. ${m.workspaces.name} (${m.workspaces.client_code})`);
    console.log(`   Role: ${m.role}`);
    console.log(`   ID: ${m.workspaces.id}\n`);
  });
}
