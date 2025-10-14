import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findStan() {
  console.log('🔍 Searching for Stan Bournev...\n');

  // Search all users for "stan" or "bournev"
  const { data: { users } } = await supabase.auth.admin.listUsers();

  const matches = users.filter(u =>
    u.email?.toLowerCase().includes('stan') ||
    u.email?.toLowerCase().includes('bournev') ||
    u.user_metadata?.full_name?.toLowerCase().includes('stan') ||
    u.user_metadata?.full_name?.toLowerCase().includes('bournev')
  );

  if (matches.length === 0) {
    console.log('❌ No users found with "stan" or "bournev"');
    console.log('\n🔍 Searching Blue Label Labs workspace members...\n');

    // Search for Blue Label Labs workspace
    const { data: blWorkspace } = await supabase
      .from('workspaces')
      .select('id, name, tenant')
      .or('name.ilike.%blue%label%,tenant.eq.bluelabel')
      .single();

    if (blWorkspace) {
      console.log(`✅ Found workspace: ${blWorkspace.name}`);
      console.log(`   ID: ${blWorkspace.id}`);
      console.log(`   Tenant: ${blWorkspace.tenant}\n`);

      // Get all members
      const { data: members } = await supabase
        .from('workspace_members')
        .select('user_id, role, users(email, raw_user_meta_data)')
        .eq('workspace_id', blWorkspace.id);

      console.log(`Workspace Members (${members?.length || 0}):`);
      members?.forEach(m => {
        console.log(`   - ${m.users.email} (${m.role})`);
        if (m.users.raw_user_meta_data?.full_name) {
          console.log(`     Name: ${m.users.raw_user_meta_data.full_name}`);
        }
      });
    } else {
      console.log('❌ Blue Label Labs workspace not found');
    }
    return;
  }

  console.log(`✅ Found ${matches.length} matching user(s):\n`);

  for (const user of matches) {
    console.log(`📧 ${user.email}`);
    console.log(`   ID: ${user.id}`);
    if (user.user_metadata?.full_name) {
      console.log(`   Name: ${user.user_metadata.full_name}`);
    }

    // Check workspace membership
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces(name, tenant)')
      .eq('user_id', user.id);

    console.log(`   Workspaces: ${memberships?.length || 0}`);
    memberships?.forEach(m => {
      console.log(`     - ${m.workspaces.name} (${m.workspaces.tenant}) - ${m.role}`);
    });

    // Check LinkedIn accounts
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('account_type, account_name, connection_status, workspace_id, workspaces(name)')
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin');

    console.log(`   LinkedIn Accounts: ${accounts?.length || 0}`);
    accounts?.forEach(a => {
      console.log(`     - ${a.account_name || 'Unnamed'} → ${a.workspaces.name} (${a.connection_status})`);
    });

    console.log('');
  }
}

findStan();
