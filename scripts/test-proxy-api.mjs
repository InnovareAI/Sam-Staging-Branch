#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testProxyAPI() {
  const userEmail = 'tl@innovareai.com';
  
  // Simulate what the API does
  const { data: user } = await supabase.auth.admin.listUsers();
  const targetUser = user.users.find(u => u.email === userEmail);
  
  if (!targetUser) {
    console.log('❌ User not found');
    return;
  }
  
  console.log('✅ User found:', targetUser.email);
  
  // Get workspace
  const { data: userProfile } = await supabase
    .from('users')
    .select('current_workspace_id')
    .eq('id', targetUser.id)
    .single();
  
  console.log('   Workspace:', userProfile?.current_workspace_id);
  
  // Get LinkedIn accounts
  const { data: linkedinAccounts } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id, account_name, account_identifier')
    .eq('workspace_id', userProfile.current_workspace_id)
    .eq('user_id', targetUser.id)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected');
  
  console.log(`\n📋 LinkedIn accounts found: ${linkedinAccounts?.length || 0}`);
  linkedinAccounts?.forEach(acc => {
    console.log(`   - ${acc.account_name} (${acc.unipile_account_id})`);
  });
  
  if (!linkedinAccounts || linkedinAccounts.length === 0) {
    console.log('\n❌ API would return: { success: true, has_linkedin: false, accounts: [] }');
    return;
  }
  
  console.log('\n✅ API would return: { success: true, has_linkedin: true, accounts: [...] }');
}

testProxyAPI().catch(console.error);
