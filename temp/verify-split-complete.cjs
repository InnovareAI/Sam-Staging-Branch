const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyWorkspaceSplit() {
  console.log('🔍 VERIFYING WORKSPACE SPLIT\n');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Check all workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, client_code, slug')
    .in('name', ['IA1', 'IA2', 'IA3', 'IA4', 'IA5', 'IA6', 'SC1', 'SC2'])
    .order('name');

  console.log('📊 WORKSPACES CREATED:\n');
  workspaces.forEach(ws => {
    console.log(`  ${ws.name} (${ws.client_code}) - slug: ${ws.slug}`);
  });

  // 2. Check workspace memberships
  console.log('\n═══════════════════════════════════════════════════\n');
  console.log('👥 WORKSPACE MEMBERSHIPS:\n');

  for (const ws of workspaces) {
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id, role, users(email)')
      .eq('workspace_id', ws.id);

    console.log(`${ws.name}:`);
    if (members && members.length > 0) {
      members.forEach(m => {
        console.log(`  - ${m.users.email} (${m.role})`);
      });
    } else {
      console.log('  - No members found');
    }
    console.log('');
  }

  // 3. Check LinkedIn accounts distribution
  console.log('═══════════════════════════════════════════════════\n');
  console.log('🔗 LINKEDIN ACCOUNTS:\n');

  for (const ws of workspaces) {
    const { data: accounts } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id, account_name')
      .eq('workspace_id', ws.id)
      .eq('provider', 'linkedin');

    if (accounts && accounts.length > 0) {
      console.log(`${ws.name}:`);
      accounts.forEach(acc => {
        console.log(`  - ${acc.account_name || acc.unipile_account_id}`);
      });
      console.log('');
    }
  }

  // 4. Check campaigns distribution
  console.log('═══════════════════════════════════════════════════\n');
  console.log('📧 CAMPAIGNS:\n');

  for (const ws of workspaces) {
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name')
      .eq('workspace_id', ws.id);

    if (campaigns && campaigns.length > 0) {
      console.log(`${ws.name}: ${campaigns.length} campaigns`);
      campaigns.slice(0, 3).forEach(c => {
        console.log(`  - ${c.name}`);
      });
      if (campaigns.length > 3) {
        console.log(`  ... and ${campaigns.length - 3} more`);
      }
      console.log('');
    }
  }

  // 5. Summary
  console.log('═══════════════════════════════════════════════════\n');
  console.log('✅ WORKSPACE SPLIT VERIFICATION COMPLETE\n');
  console.log(`Total workspaces: ${workspaces.length}`);
  console.log('\nExpected structure:');
  console.log('  IA1 → Thorsten + admin1@innovareai.com');
  console.log('  IA2 → Michelle + admin2@innovareai.com');
  console.log('  IA3 → Irish + admin3@innovareai.com');
  console.log('  IA4 → Charissa + admin4@innovareai.com');
  console.log('  IA5 → Jennifer + admin5@innovareai.com');
  console.log('  IA6 → Chona + admin6@innovareai.com');
  console.log('  SC1 → Jim Heim + Cathy');
  console.log('  SC2 → Dave Stuteville + Cathy');
  console.log('\n═══════════════════════════════════════════════════\n');
}

verifyWorkspaceSplit().catch(console.error);
