#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLinkedInAccount() {
  const accountId = 'lN6tdIWOStK_dEaxhygCEQ';
  
  console.log(`🔍 Checking LinkedIn account: ${accountId}\n`);

  // Check user_unipile_accounts
  const { data: account, error: accountError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('unipile_account_id', accountId)
    .maybeSingle();

  if (accountError) {
    console.error('❌ Query error:', accountError);
    return;
  }

  if (!account) {
    console.log('❌ LinkedIn account not found in user_unipile_accounts table');
    console.log('\n💡 Account needs to be added to the database');
    return;
  }

  console.log('✅ Account found in database:');
  console.log('   User ID:', account.user_id);
  console.log('   Workspace ID:', account.workspace_id);
  console.log('   Provider:', account.provider);
  console.log('   Status:', account.status);
  console.log('   Connected at:', account.connected_at);

  // Check user info
  if (account.user_id) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.id === account.user_id);
    if (user) {
      console.log('\n👤 Connected to user:', user.email);
    }
  }

  // Check workspace_members for linkedin_unipile_account_id
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('user_id, role, linkedin_unipile_account_id')
    .eq('linkedin_unipile_account_id', accountId)
    .maybeSingle();

  if (member) {
    console.log('\n✅ Set as primary LinkedIn in workspace_members:');
    console.log('   User ID:', member.user_id);
    console.log('   Role:', member.role);
  } else {
    console.log('\n⚠️  Not set as primary LinkedIn in workspace_members');
    console.log('   This might cause search to fail');
  }
}

checkLinkedInAccount().catch(console.error);
