const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Checking all workspaces EXCEPT InnovareAI...\n');

  const innovareWorkspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  // Get all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .neq('id', innovareWorkspaceId)
    .order('name');

  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  console.log(`Found ${workspaces.length} workspaces (excluding InnovareAI)\n`);
  console.log('═══════════════════════════════════════════════════\n');

  for (const ws of workspaces) {
    console.log(`📁 ${ws.name}`);
    console.log(`   ID: ${ws.id}`);
    console.log(`   Created: ${ws.created_at}\n`);

    // Get members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, status, joined_at')
      .eq('workspace_id', ws.id)
      .order('role', { ascending: false });

    console.log(`   👥 Members (${members?.length || 0}):`);

    if (members && members.length > 0) {
      members.forEach(m => {
        const user = users.find(u => u.id === m.user_id);
        console.log(`      - ${user?.email || 'Unknown'}`);
        console.log(`        Role: ${m.role}`);
        console.log(`        Status: ${m.status}`);
        console.log(`        Joined: ${m.joined_at}`);
      });
    } else {
      console.log('      (No members)');
    }

    // Get LinkedIn accounts in this workspace
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('account_name, account_type, unipile_account_id, is_active')
      .eq('workspace_id', ws.id)
      .eq('account_type', 'linkedin');

    console.log(`\n   🔗 LinkedIn Accounts (${accounts?.length || 0}):`);
    if (accounts && accounts.length > 0) {
      accounts.forEach(acc => {
        console.log(`      - ${acc.account_name}`);
        console.log(`        Active: ${acc.is_active}`);
        console.log(`        Unipile ID: ${acc.unipile_account_id || 'NOT SET'}`);
      });
    } else {
      console.log('      (No LinkedIn accounts)');
    }

    // Get campaigns in this workspace
    const { data: campaigns, count } = await supabase
      .from('campaigns')
      .select('id, name, created_by, status', { count: 'exact' })
      .eq('workspace_id', ws.id);

    console.log(`\n   📊 Campaigns (${count || 0}):`);
    if (campaigns && campaigns.length > 0) {
      campaigns.slice(0, 5).forEach(c => {
        const creator = users.find(u => u.id === c.created_by);
        console.log(`      - ${c.name} (${c.status})`);
        console.log(`        Created by: ${creator?.email || 'Unknown'}`);
      });
      if (campaigns.length > 5) {
        console.log(`      ... and ${campaigns.length - 5} more`);
      }
    } else {
      console.log('      (No campaigns)');
    }

    console.log('\n═══════════════════════════════════════════════════\n');
  }

  // Summary
  console.log('📈 SUMMARY:\n');
  for (const ws of workspaces) {
    const { count: memberCount } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', ws.id);

    const { count: accountCount } = await supabase
      .from('workspace_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', ws.id)
      .eq('account_type', 'linkedin');

    const { count: campaignCount } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', ws.id);

    console.log(`${ws.name}:`);
    console.log(`  Members: ${memberCount || 0}`);
    console.log(`  LinkedIn Accounts: ${accountCount || 0}`);
    console.log(`  Campaigns: ${campaignCount || 0}`);
    console.log('');
  }
})();
