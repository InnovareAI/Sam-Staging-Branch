import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser(email) {
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === email);

  console.log(`👤 ${email}:\n`);

  if (!user) {
    console.log('❌ User does NOT exist in auth system');
    return;
  }

  console.log('✅ User exists:');
  console.log(`   ID: ${user.id}`);
  console.log('');

  // Check workspace membership
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', user.id);

  console.log(`Workspace Memberships: ${memberships?.length || 0}`);
  if (memberships?.length > 0) {
    memberships.forEach(m => {
      console.log(`   - ${m.workspaces.name} (role: ${m.role})`);
    });
  } else {
    console.log('   ❌ NOT a member of any workspace');
  }
  console.log('');

  // Check accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('account_type, account_name, account_identifier, workspace_id, workspaces(name)')
    .eq('user_id', user.id);

  console.log(`Workspace Accounts: ${accounts?.length || 0}`);
  if (accounts?.length > 0) {
    accounts.forEach(a => {
      console.log(`   - ${a.account_type}: ${a.account_name || a.account_identifier} → ${a.workspaces.name}`);
    });
  } else {
    console.log('   ❌ NO accounts connected');
  }
}

const email = process.argv[2] || 'samantha@truepeopleconsulting.com';
checkUser(email);
