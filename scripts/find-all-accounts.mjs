#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findAll() {
  const { data: user } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', 'tl@innovareai.com')
    .single();
  
  console.log(`\n👤 User: ${user.email}`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Current workspace: ${user.current_workspace_id}`);
  
  // Get all accounts for this user
  const { data: allAccounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('account_type', 'linkedin');
  
  console.log(`\n📋 All LinkedIn accounts (${allAccounts?.length || 0}):`);
  allAccounts?.forEach(acc => {
    console.log(`\n- ${acc.unipile_account_id}`);
    console.log(`  Name: ${acc.account_name}`);
    console.log(`  Email: ${acc.account_identifier}`);
    console.log(`  Status: "${acc.connection_status}"`);
    console.log(`  Workspace: ${acc.workspace_id}`);
    console.log(`  Is current workspace: ${acc.workspace_id === user.current_workspace_id ? 'YES ✅' : 'NO ❌'}`);
  });
  
  if (allAccounts && allAccounts.length > 0) {
    const wrongWorkspace = allAccounts.filter(acc => acc.workspace_id !== user.current_workspace_id);
    if (wrongWorkspace.length > 0) {
      console.log(`\n⚠️  Found ${wrongWorkspace.length} account(s) in WRONG workspace!`);
      console.log('💡 Need to move them to current workspace:', user.current_workspace_id);
    }
  }
}

findAll().catch(console.error);
