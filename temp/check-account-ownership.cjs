#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAccountOwnership() {
  console.log('🔍 Checking LinkedIn account ownership...\n');

  // Get all workspace_accounts for the user's workspace
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('id, account_name, user_id, workspace_id, unipile_account_id')
    .eq('account_type', 'linkedin')
    .order('workspace_id, user_id');

  if (!accounts || accounts.length === 0) {
    console.log('❌ No LinkedIn accounts found');
    return;
  }

  // Group by workspace and user
  const workspaceGroups = {};

  for (const account of accounts) {
    if (!workspaceGroups[account.workspace_id]) {
      workspaceGroups[account.workspace_id] = {};
    }
    if (!workspaceGroups[account.workspace_id][account.user_id]) {
      workspaceGroups[account.workspace_id][account.user_id] = [];
    }
    workspaceGroups[account.workspace_id][account.user_id].push(account);
  }

  // Get workspace names
  const workspaceIds = Object.keys(workspaceGroups);
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .in('id', workspaceIds);

  const workspaceMap = {};
  workspaces?.forEach(ws => {
    workspaceMap[ws.id] = ws.name;
  });

  // Get user emails
  const userIds = [...new Set(accounts.map(a => a.user_id))];
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const userMap = {};
  users?.forEach(user => {
    userMap[user.id] = user.email;
  });

  console.log('📊 LinkedIn Accounts by Workspace and User:\n');

  for (const [workspaceId, users] of Object.entries(workspaceGroups)) {
    console.log(`🏢 Workspace: ${workspaceMap[workspaceId] || workspaceId}`);
    console.log(`   Workspace ID: ${workspaceId}\n`);

    for (const [userId, userAccounts] of Object.entries(users)) {
      console.log(`   👤 User: ${userMap[userId] || userId}`);
      console.log(`      User ID: ${userId}`);
      console.log(`      Accounts (${userAccounts.length}):`);

      userAccounts.forEach((acc, i) => {
        console.log(`         ${i + 1}. ${acc.account_name}`);
      });
      console.log('');
    }
    console.log('='.repeat(70) + '\n');
  }

  // Check for issues
  console.log('⚠️  PRIVACY CHECK:\n');

  for (const [workspaceId, users] of Object.entries(workspaceGroups)) {
    const userCount = Object.keys(users).length;
    const totalAccounts = Object.values(users).reduce((sum, accs) => sum + accs.length, 0);

    console.log(`Workspace: ${workspaceMap[workspaceId]}`);
    console.log(`  Users with LinkedIn: ${userCount}`);
    console.log(`  Total accounts: ${totalAccounts}`);

    if (userCount > 1) {
      console.log(`  ⚠️  MULTIPLE USERS - Each should only see their OWN account!`);
    }
    console.log('');
  }
}

checkAccountOwnership().catch(console.error);
