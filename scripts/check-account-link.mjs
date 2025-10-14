import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAccountLink() {
  const accountId = 'mERQmojtSZq5GeomZZazlw';
  const userEmail = 'tl@innovareai.com';

  console.log(`\n🔍 Checking if Unipile account ${accountId} is linked to ${userEmail}...\n`);

  // Get user ID
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email === userEmail);

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`👤 User ID: ${user.id}`);
  console.log(`📧 Email: ${user.email}\n`);

  // Check workspace_accounts table
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('unipile_account_id', accountId);

  if (!accounts || accounts.length === 0) {
    console.log(`❌ Account ID "${accountId}" NOT FOUND in workspace_accounts table\n`);

    // Show all accounts for this user
    const { data: userAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin');

    console.log(`📋 LinkedIn accounts linked to ${userEmail}:`);
    if (userAccounts && userAccounts.length > 0) {
      userAccounts.forEach(acc => {
        console.log(`   - ${acc.account_name}`);
        console.log(`     Unipile ID: ${acc.unipile_account_id}`);
        console.log(`     Workspace: ${acc.workspace_id}`);
        console.log('');
      });
    } else {
      console.log('   ❌ No LinkedIn accounts found');
    }
    return;
  }

  console.log(`✅ Account FOUND in database:\n`);
  accounts.forEach(acc => {
    console.log(`   Account Name: ${acc.account_name}`);
    console.log(`   Account Type: ${acc.account_type}`);
    console.log(`   Workspace ID: ${acc.workspace_id}`);
    console.log(`   User ID: ${acc.user_id}`);
    console.log(`   Status: ${acc.connection_status}`);
    console.log(`   Connected At: ${acc.connected_at}`);

    if (acc.user_id === user.id) {
      console.log(`   ✅ LINKED TO ${userEmail}`);
    } else {
      console.log(`   ⚠️  Linked to different user: ${acc.user_id}`);
    }
    console.log('');
  });

  // Get workspace name
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', accounts[0].workspace_id)
    .single();

  console.log(`🏢 Workspace: ${workspace?.name || 'Unknown'}`);
}

checkAccountLink();
