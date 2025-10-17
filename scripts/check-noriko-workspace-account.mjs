#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkspaceAccount() {
  const accountId = 'lN6tdIWOStK_dEaxhygCEQ';
  const userId = '567ba664-812c-4bed-8c2f-96113b99f899'; // ny@3cubed.ai
  const workspaceId = 'ecb08e55-2b7e-4d49-8f50-d38e39ce2482'; // 3cubed
  
  console.log('🔍 Checking workspace_accounts table...\n');

  // Check workspace_accounts
  const { data: accounts, error } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('unipile_account_id', accountId);

  console.log('Query error:', error);
  console.log('Accounts found:', accounts?.length || 0);
  
  if (accounts && accounts.length > 0) {
    console.log('\n✅ Account records:');
    accounts.forEach(acc => {
      console.log('  - Workspace:', acc.workspace_id);
      console.log('    User:', acc.user_id);
      console.log('    Type:', acc.account_type);
      console.log('    Status:', acc.connection_status);
      console.log('    Name:', acc.account_name);
    });
  } else {
    console.log('\n❌ No workspace_accounts record found!');
    console.log('   This is why the search fails.');
    console.log('\n🔧 Need to add record to workspace_accounts table');
  }

  // Check what accounts exist for this user
  console.log('\n🔍 Checking all accounts for this user...');
  const { data: userAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', userId);

  console.log(`\nUser has ${userAccounts?.length || 0} workspace account(s)`);
  if (userAccounts && userAccounts.length > 0) {
    userAccounts.forEach(acc => {
      console.log(`  - ${acc.account_type}: ${acc.account_name} (${acc.unipile_account_id})`);
    });
  }
}

checkWorkspaceAccount().catch(console.error);
