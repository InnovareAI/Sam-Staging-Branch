#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function addLinkedInAccount() {
  const userEmail = 'tl@innovareai.com';
  
  console.log('\n🔍 Looking up user and account info...');
  
  // Get user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, current_workspace_id')
    .eq('email', userEmail)
    .single();
  
  if (userError || !user) {
    console.error('❌ User not found:', userError);
    return;
  }
  
  console.log('✅ User found:', user.email);
  console.log('   User ID:', user.id);
  console.log('   Workspace ID:', user.current_workspace_id);
  
  // Get user's LinkedIn account from user_unipile_accounts
  const { data: unipileAccounts, error: accountsError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'LINKEDIN');
  
  if (accountsError || !unipileAccounts || unipileAccounts.length === 0) {
    console.error('❌ No LinkedIn accounts found in user_unipile_accounts');
    return;
  }
  
  console.log(`\n📋 Found ${unipileAccounts.length} LinkedIn account(s):`);
  unipileAccounts.forEach((acc, i) => {
    console.log(`   ${i + 1}. ${acc.unipile_account_id} (${acc.connection_status})`);
  });
  
  // Use the first active account
  const activeAccount = unipileAccounts.find(acc => acc.connection_status === 'active') || unipileAccounts[0];
  
  console.log(`\n✅ Using account: ${activeAccount.unipile_account_id}`);
  
  // Insert into workspace_accounts
  const accountData = {
    workspace_id: user.current_workspace_id,
    user_id: user.id,
    account_type: 'linkedin',
    account_identifier: userEmail, // Use user email as identifier
    unipile_account_id: activeAccount.unipile_account_id,
    connection_status: 'connected',
    account_name: 'Thorsten Linz' // Your name
  };
  
  console.log('\n💾 Inserting into workspace_accounts...');
  
  const { data, error } = await supabase
    .from('workspace_accounts')
    .insert(accountData)
    .select();
  
  if (error) {
    console.error('❌ Failed to insert:', error);
    return;
  }
  
  console.log('✅ Successfully added LinkedIn account to workspace_accounts!');
  console.log('   Record ID:', data[0].id);
  console.log('\n🎉 Now refresh your proxy modal and it should show proxy info!');
}

addLinkedInAccount().catch(console.error);
