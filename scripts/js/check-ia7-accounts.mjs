#!/usr/bin/env node
/**
 * Check IA7 LinkedIn account status
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7
const USER_ID = '59b1063e-672c-49c6-b3b7-02081a500209'; // tbslinz@icloud.com

console.log('🔍 CHECKING IA7 STATUS...\n');

// 1. Check LinkedIn accounts
const { data: accounts, error: accountsError } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID);

console.log('💼 LinkedIn Accounts:');
if (accountsError) {
  console.error('❌ Error:', accountsError.message);
} else if (!accounts || accounts.length === 0) {
  console.log('❌ No accounts found');
} else {
  accounts.forEach(account => {
    console.log(`\n   Account: ${account.account_name}`);
    console.log(`   Unipile ID: ${account.unipile_account_id}`);
    console.log(`   Status: ${account.connection_status}`);
    console.log(`   Active: ${account.is_active}`);
    console.log(`   User ID: ${account.user_id}`);
  });
}

// 2. Check recent campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, campaign_name, status, created_at')
  .eq('workspace_id', WORKSPACE_ID)
  .order('created_at', { ascending: false })
  .limit(5);

console.log('\n📊 Recent Campaigns:');
if (campaigns && campaigns.length > 0) {
  campaigns.forEach(c => {
    console.log(`\n   ${c.campaign_name}`);
    console.log(`   Status: ${c.status}`);
    console.log(`   Created: ${new Date(c.created_at).toLocaleString()}`);
    console.log(`   ID: ${c.id}`);
  });
} else {
  console.log('   No campaigns yet');
}

// 3. Check if user owns the accounts
console.log('\n🔐 Account Ownership:');
if (accounts && accounts.length > 0) {
  accounts.forEach(account => {
    const isOwner = account.user_id === USER_ID;
    console.log(`   ${account.account_name}: ${isOwner ? '✅ Owned by current user' : '❌ Not owned by current user'}`);
    if (!isOwner) {
      console.log(`      Account user_id: ${account.user_id}`);
      console.log(`      Current user_id: ${USER_ID}`);
    }
  });
}
