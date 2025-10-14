import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBlueLabel() {
  console.log('🔍 Checking Blue Label Labs Workspace...\n');

  // Find Blue Label Labs workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .or('name.ilike.%blue%label%,tenant.eq.bluelabel')
    .single();

  if (!workspace) {
    console.log('❌ Blue Label Labs workspace not found!');
    return;
  }

  console.log('✅ Workspace Found:');
  console.log(`   ID: ${workspace.id}`);
  console.log(`   Name: ${workspace.name}`);
  console.log(`   Tenant: ${workspace.tenant}`);
  console.log(`   Reseller: ${workspace.reseller_affiliation || 'N/A'}`);
  console.log('');

  // Get workspace members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email, raw_user_meta_data)')
    .eq('workspace_id', workspace.id);

  console.log(`👥 Workspace Members (${members?.length || 0}):`);
  if (members && members.length > 0) {
    members.forEach(m => {
      console.log(`   - ${m.users.email} (${m.role})`);
      if (m.users.raw_user_meta_data?.full_name) {
        console.log(`     Name: ${m.users.raw_user_meta_data.full_name}`);
      }
    });
  } else {
    console.log('   ❌ NO MEMBERS in this workspace!');
  }
  console.log('');

  // Get workspace LinkedIn accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('id, user_id, account_type, account_name, connection_status, users(email)')
    .eq('workspace_id', workspace.id)
    .eq('account_type', 'linkedin');

  console.log(`🔗 LinkedIn Accounts (${accounts?.length || 0}):`);
  if (accounts && accounts.length > 0) {
    accounts.forEach(a => {
      console.log(`   - ${a.account_name || 'Unnamed'}`);
      console.log(`     User: ${a.users?.email || 'Unknown'}`);
      console.log(`     Status: ${a.connection_status}`);
    });
  } else {
    console.log('   ❌ NO LinkedIn accounts connected!');
  }
  console.log('');

  // Check for Stan's account specifically
  console.log('🔍 Checking Stan\'s LinkedIn account...\n');
  const { data: stanAccount } = await supabase
    .from('workspace_accounts')
    .select('*, workspaces(name)')
    .eq('user_id', '6a927440-ebe1-49b4-ae5e-fbee5d27944d')
    .eq('account_type', 'linkedin')
    .single();

  if (stanAccount) {
    console.log('✅ Stan\'s LinkedIn Account:');
    console.log(`   Account Name: ${stanAccount.account_name}`);
    console.log(`   Status: ${stanAccount.connection_status}`);
    console.log(`   Connected to Workspace: ${stanAccount.workspaces?.name}`);
    console.log(`   Workspace ID: ${stanAccount.workspace_id}`);
    console.log('');

    if (stanAccount.workspace_id !== workspace.id) {
      console.log('⚠️  WARNING: Stan\'s LinkedIn is connected to a DIFFERENT workspace!');
      console.log(`   Stan's LinkedIn workspace: ${stanAccount.workspace_id}`);
      console.log(`   Blue Label Labs workspace: ${workspace.id}`);
    }
  }
}

checkBlueLabel();
