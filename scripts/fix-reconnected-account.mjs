import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixReconnectedAccount() {
  const userEmail = 'tl@innovareai.com';
  const newUnipileId = 'mERQmojtSZq5GeomZZazlw';
  const oldUnipileId = 'aRT-LuSWTa-FmtSIE8p6aA';

  console.log('\n🔧 Fixing reconnected LinkedIn account...\n');

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`👤 User: ${user.email} (${user.id})`);
  console.log(`🔄 Old Unipile ID: ${oldUnipileId}`);
  console.log(`✨ New Unipile ID: ${newUnipileId}\n`);

  // Remove old disconnected account
  const { error: deleteError } = await supabase
    .from('workspace_accounts')
    .delete()
    .eq('unipile_account_id', oldUnipileId);

  if (deleteError) {
    console.log('⚠️  Error deleting old account:', deleteError.message);
  } else {
    console.log('✅ Removed old disconnected account from database');
  }

  // Add new reconnected account
  const { data: newAccount, error: insertError } = await supabase
    .from('workspace_accounts')
    .insert({
      workspace_id: 'babdcab8-1a78-4b2f-913e-6e9fd9821009', // InnovareAI Workspace
      user_id: user.id,
      account_type: 'linkedin',
      account_name: 'Thorsten Linz',
      account_identifier: 'thorsten-linz', // LinkedIn username/identifier
      unipile_account_id: newUnipileId,
      connection_status: 'connected',
      connected_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.log('❌ Error adding new account:', insertError.message);
  } else {
    console.log('✅ Added new reconnected account to database');
    console.log('\n📋 New Account Details:');
    console.log(`   Name: ${newAccount.account_name}`);
    console.log(`   Unipile ID: ${newAccount.unipile_account_id}`);
    console.log(`   Workspace: ${newAccount.workspace_id}`);
    console.log(`   Status: ${newAccount.connection_status}`);
    console.log('\n🎉 Account reconnection fixed! You can now search with Sales Navigator.');
  }
}

fixReconnectedAccount();
