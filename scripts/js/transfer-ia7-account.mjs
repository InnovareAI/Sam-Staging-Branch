#!/usr/bin/env node
/**
 * Transfer LinkedIn account ownership to new IA7 owner
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = '85e80099-12f9-491a-a0a1-ad48d086a9f0'; // IA7
const NEW_OWNER_ID = '59b1063e-672c-49c6-b3b7-02081a500209'; // tbslinz@icloud.com

console.log('🔄 TRANSFERRING LINKEDIN ACCOUNT OWNERSHIP...\n');

// Update all workspace accounts to new owner
const { data: accounts, error: updateError } = await supabase
  .from('workspace_accounts')
  .update({ user_id: NEW_OWNER_ID })
  .eq('workspace_id', WORKSPACE_ID)
  .select();

if (updateError) {
  console.error('❌ Error:', updateError.message);
  process.exit(1);
}

console.log('✅ Account ownership transferred:');
accounts.forEach(account => {
  console.log(`   ${account.account_name}`);
  console.log(`   Unipile ID: ${account.unipile_account_id}`);
  console.log(`   New Owner: ${NEW_OWNER_ID}`);
});

console.log('\n✅ Ready to create campaigns!');
console.log('   Refresh the page and try creating the campaign again');
