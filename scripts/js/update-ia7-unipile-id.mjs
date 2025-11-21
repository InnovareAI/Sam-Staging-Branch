#!/usr/bin/env node
/**
 * Update IA7 LinkedIn account with correct Unipile ID
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7
const USER_ID = '59b1063e-672c-49c6-b3b7-02081a500209'; // tbslinz@icloud.com
const CORRECT_UNIPILE_ID = 'xT9TYxlYTTC1ukKenVPhLA'; // From Unipile

console.log('🔧 UPDATING IA7 UNIPILE ACCOUNT ID...\n');

// Check if account with correct Unipile ID already exists
const { data: existingAccount } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('unipile_account_id', CORRECT_UNIPILE_ID)
  .single();

if (existingAccount) {
  console.log('✅ Account with correct Unipile ID already exists:');
  console.log(`   Account: ${existingAccount.account_name}`);
  console.log(`   Workspace: ${existingAccount.workspace_id}`);

  // Just update workspace and user if needed
  if (existingAccount.workspace_id !== WORKSPACE_ID || existingAccount.user_id !== USER_ID) {
    console.log('\n📝 Updating workspace and user...');

    const { error: updateError } = await supabase
      .from('workspace_accounts')
      .update({
        workspace_id: WORKSPACE_ID,
        user_id: USER_ID,
        is_active: true,
        connection_status: 'connected'
      })
      .eq('unipile_account_id', CORRECT_UNIPILE_ID);

    if (updateError) {
      console.error('❌ Error:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Updated to IA7 workspace');
  }
} else {
  console.log('⚠️  No account found with Unipile ID:', CORRECT_UNIPILE_ID);
  console.log('📝 Updating existing account record...\n');

  // Update the old account with correct Unipile ID
  const { error: updateError } = await supabase
    .from('workspace_accounts')
    .update({
      unipile_account_id: CORRECT_UNIPILE_ID,
      user_id: USER_ID,
      workspace_id: WORKSPACE_ID,
      is_active: true,
      connection_status: 'connected'
    })
    .eq('workspace_id', WORKSPACE_ID);

  if (updateError) {
    console.error('❌ Error:', updateError.message);
    process.exit(1);
  }

  console.log('✅ Account updated with correct Unipile ID');
}

// Verify
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .eq('workspace_id', WORKSPACE_ID);

console.log('\n🔍 Verification - IA7 Accounts:');
accounts.forEach(account => {
  console.log(`\n   Account: ${account.account_name}`);
  console.log(`   Unipile ID: ${account.unipile_account_id}`);
  console.log(`   Status: ${account.connection_status}`);
  console.log(`   Active: ${account.is_active}`);
  console.log(`   User ID: ${account.user_id}`);
});

console.log('\n✅ Ready to create campaigns!');
