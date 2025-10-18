#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findAssignment() {
  const accountId = 'aRT-LuSWTa-FmtSIE8p6aA';
  
  console.log(`\n🔍 Searching for Unipile account: ${accountId}`);
  console.log('━'.repeat(60));
  
  // Check workspace_accounts
  const { data: workspaceAccounts } = await supabase
    .from('workspace_accounts')
    .select('*, users!inner(email)')
    .eq('unipile_account_id', accountId);
  
  if (workspaceAccounts && workspaceAccounts.length > 0) {
    console.log('\n📋 Found in workspace_accounts:');
    workspaceAccounts.forEach(acc => {
      console.log(`   User: ${acc.users.email}`);
      console.log(`   Workspace: ${acc.workspace_id}`);
      console.log(`   Status: ${acc.connection_status}`);
      console.log(`   Account name: ${acc.account_name}`);
      console.log(`   Record ID: ${acc.id}`);
      console.log('');
    });
  } else {
    console.log('\n❌ Not found in workspace_accounts');
  }
  
  // Check all LinkedIn accounts for tl@innovareai.com
  const { data: user } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', 'tl@innovareai.com')
    .single();
  
  if (user) {
    console.log(`\n👤 Checking all accounts for ${user.email}:`);
    const { data: allAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin');
    
    if (allAccounts && allAccounts.length > 0) {
      console.log(`   Found ${allAccounts.length} LinkedIn account(s):`);
      allAccounts.forEach(acc => {
        console.log(`   - ${acc.unipile_account_id} (${acc.account_name || acc.account_identifier})`);
      });
    } else {
      console.log('   No LinkedIn accounts found');
    }
  }
}

findAssignment().catch(console.error);
