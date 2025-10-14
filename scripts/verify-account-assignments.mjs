import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAccounts() {
  // Get all accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .order('workspace_id', { ascending: true });

  // Get users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  // Get workspaces
  const { data: workspaces } = await supabase.from('workspaces').select('*');

  const userMap = {};
  users.forEach(u => { userMap[u.id] = u.email; });

  const workspaceMap = {};
  workspaces.forEach(w => { workspaceMap[w.id] = w.name; });

  console.log('📋 ALL WORKSPACE ACCOUNTS:\n');

  const accountsToCheck = [
    'Charissa Saniel',
    'Stan Bounev',
    'Jim Heim',
    'Michelle Angelica Gestuveo',
    'Noriko Yokoi',
    'Thorsten Linz',
    'Irish Maguad',
    'jf@innovareai.com',
    'tl@innovareai.com'
  ];

  accountsToCheck.forEach(name => {
    const account = accounts.find(a =>
      a.account_name?.includes(name) ||
      a.account_identifier?.includes(name)
    );

    if (account) {
      console.log(`✅ ${name}`);
      console.log(`   Type: ${account.account_type}`);
      console.log(`   Workspace: ${workspaceMap[account.workspace_id]}`);
      console.log(`   Connected by: ${userMap[account.user_id]}`);
      console.log(`   Status: ${account.connection_status}`);
      console.log('');
    } else {
      console.log(`❌ ${name} - NOT FOUND`);
      console.log('');
    }
  });

  console.log('\n📊 Summary by Workspace:\n');

  const byWorkspace = {};
  accounts.forEach(a => {
    if (!byWorkspace[a.workspace_id]) {
      byWorkspace[a.workspace_id] = [];
    }
    byWorkspace[a.workspace_id].push(a);
  });

  Object.entries(byWorkspace).forEach(([workspaceId, accts]) => {
    console.log(`🏢 ${workspaceMap[workspaceId]}:`);
    accts.forEach(a => {
      console.log(`   - ${a.account_type}: ${a.account_name || a.account_identifier} (by ${userMap[a.user_id]})`);
    });
    console.log('');
  });
}

verifyAccounts();
