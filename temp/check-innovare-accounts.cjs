const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Checking InnovareAI workspace accounts...\n');

  const innovareWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  // Get members
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, status')
    .eq('workspace_id', innovareWorkspaceId);

  // Get LinkedIn accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', innovareWorkspaceId)
    .eq('account_type', 'linkedin');

  console.log('👥 MEMBERS:\n');
  members.forEach(m => {
    const user = users.find(u => u.id === m.user_id);
    console.log(`  ${user?.email || 'Unknown'}`);
    console.log(`    User ID: ${m.user_id}`);
    console.log(`    Role: ${m.role}`);
    console.log('');
  });

  console.log('🔗 LINKEDIN ACCOUNTS:\n');
  accounts.forEach(acc => {
    console.log(`  ${acc.account_name}`);
    console.log(`    Account ID: ${acc.id}`);
    console.log(`    Unipile ID: ${acc.unipile_account_id}`);
    console.log(`    Active: ${acc.is_active}`);
    console.log('');
  });

  console.log('📊 SUMMARY:');
  console.log(`  Total members: ${members.length}`);
  console.log(`  Total LinkedIn accounts: ${accounts.length}`);
})();
