#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllUserAccounts() {
  console.log('🔍 Checking ALL LinkedIn accounts for tl@innovareai.com...\n');

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === 'tl@innovareai.com');

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`👤 User: ${user.email}`);
  console.log(`   ID: ${user.id}\n`);

  // Get user's workspace
  const { data: userProfile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', user.id)
    .single();

  const workspaceId = userProfile?.current_workspace_id;
  console.log(`🏢 Current Workspace ID: ${workspaceId}\n`);

  // Get ALL LinkedIn accounts for this user (not filtered by workspace)
  const { data: allAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin');

  console.log(`📱 ALL LinkedIn accounts for this user (${allAccounts?.length || 0}):\n`);

  allAccounts?.forEach((acc, i) => {
    console.log(`${i + 1}. Account ID: ${acc.id}`);
    console.log(`   Workspace: ${acc.workspace_id}`);
    console.log(`   Name: ${acc.account_name}`);
    console.log(`   Base Account ID: ${acc.unipile_account_id}`);
    console.log(`   Connection Status: ${acc.connection_status}`);
    console.log(`   Is Active: ${acc.is_active}`);
    console.log(`   Sources:`, acc.unipile_sources);
    console.log(`   ${acc.workspace_id === workspaceId ? '✅ THIS IS THE CURRENT WORKSPACE' : '⚠️  Different workspace'}`);
    console.log('');
  });

  // Now check which account the API would SELECT
  console.log(`🎯 Query that execute-live/route.ts uses:\n`);
  const { data: selectedAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();

  if (selectedAccount) {
    console.log(`✅ Account that WOULD be selected by execute-live:`);
    console.log(`   Account DB ID: ${selectedAccount.id}`);
    console.log(`   Name: ${selectedAccount.account_name}`);
    console.log(`   Base Account ID: ${selectedAccount.unipile_account_id}`);
    console.log(`   Sources:`, selectedAccount.unipile_sources);

    const activeSource = selectedAccount.unipile_sources?.find(s => s.status === 'OK');
    if (activeSource) {
      console.log(`   ✅ Active source: ${activeSource.id}`);
    } else {
      console.log(`   ❌ NO ACTIVE SOURCE!`);
    }
  } else {
    console.log(`❌ NO ACCOUNT would be selected! This would cause an error.`);
  }
}

checkAllUserAccounts().catch(console.error);
