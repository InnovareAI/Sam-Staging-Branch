import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixWorkspaceAccountAssignment() {
  console.log('🔍 Checking workspace account assignments...\n');

  // Get all workspace accounts
  const { data: accounts, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching accounts:', error);
    return;
  }

  console.log(`Found ${accounts.length} workspace accounts\n`);

  // Group by workspace
  const accountsByWorkspace = {};
  const accountsByUser = {};

  for (const account of accounts) {
    // By workspace
    if (!accountsByWorkspace[account.workspace_id]) {
      accountsByWorkspace[account.workspace_id] = [];
    }
    accountsByWorkspace[account.workspace_id].push(account);

    // By user
    if (!accountsByUser[account.user_id]) {
      accountsByUser[account.user_id] = [];
    }
    accountsByUser[account.user_id].push(account);
  }

  console.log('📊 Current State:\n');
  console.log(`Unique Workspaces: ${Object.keys(accountsByWorkspace).length}`);
  console.log(`Unique Users: ${Object.keys(accountsByUser).length}\n`);

  // Get workspace names
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('id', Object.keys(accountsByWorkspace));

  const workspaceMap = {};
  workspaces?.forEach(w => {
    workspaceMap[w.id] = w.name;
  });

  // Get user emails
  const { data: users } = await supabase.auth.admin.listUsers();
  const userMap = {};
  users.users.forEach(u => {
    userMap[u.id] = u.email;
  });

  console.log('🔍 Accounts by Workspace:\n');
  for (const [workspaceId, accts] of Object.entries(accountsByWorkspace)) {
    console.log(`Workspace: ${workspaceMap[workspaceId] || workspaceId}`);
    accts.forEach(a => {
      console.log(`  - ${a.account_type}: ${a.account_name || a.account_identifier} (User: ${userMap[a.user_id] || a.user_id})`);
    });
    console.log('');
  }

  console.log('🔍 Accounts by User:\n');
  for (const [userId, accts] of Object.entries(accountsByUser)) {
    console.log(`User: ${userMap[userId] || userId}`);
    console.log(`  Total accounts: ${accts.length}`);
    console.log(`  Workspaces: ${new Set(accts.map(a => workspaceMap[a.workspace_id] || a.workspace_id)).size}`);
    accts.forEach(a => {
      console.log(`    - ${a.account_type}: ${a.account_name || a.account_identifier} → ${workspaceMap[a.workspace_id]}`);
    });
    console.log('');
  }

  // Check for issues
  console.log('⚠️  Potential Issues:\n');

  // Issue 1: Same Unipile account in multiple workspaces
  const unipileIds = {};
  for (const account of accounts) {
    if (account.unipile_account_id) {
      if (!unipileIds[account.unipile_account_id]) {
        unipileIds[account.unipile_account_id] = [];
      }
      unipileIds[account.unipile_account_id].push(account);
    }
  }

  for (const [unipileId, accts] of Object.entries(unipileIds)) {
    if (accts.length > 1) {
      console.log(`❌ Unipile account ${unipileId} is used in ${accts.length} workspaces:`);
      accts.forEach(a => {
        console.log(`   - ${workspaceMap[a.workspace_id]} (${a.workspace_id})`);
      });
      console.log('');
    }
  }

  // Issue 2: User has accounts across multiple workspaces
  for (const [userId, accts] of Object.entries(accountsByUser)) {
    const workspaces = new Set(accts.map(a => a.workspace_id));
    if (workspaces.size > 1) {
      console.log(`⚠️  User ${userMap[userId]} has accounts in ${workspaces.size} workspaces:`);
      workspaces.forEach(w => {
        const workspaceAccts = accts.filter(a => a.workspace_id === w);
        console.log(`   - ${workspaceMap[w]}: ${workspaceAccts.length} accounts`);
      });
      console.log('');
    }
  }

  console.log('\n✅ Analysis complete');
  console.log('\n💡 Recommendation:');
  console.log('   - Each workspace should have its own dedicated accounts');
  console.log('   - Each Unipile account should only be in ONE workspace');
  console.log('   - user_id should track WHO connected the account (but account belongs to workspace)');
}

fixWorkspaceAccountAssignment();
