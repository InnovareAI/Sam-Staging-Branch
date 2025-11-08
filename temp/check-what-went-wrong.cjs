const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWhatWentWrong() {
  console.log('🔍 INVESTIGATING WORKSPACE SPLIT ISSUES\n');

  // 1. Check if the original IA workspace still has members
  console.log('═══════════════════════════════════════════════════');
  console.log('1. Original InnovareAI workspace members:\n');

  const { data: origMembers, error: membersError } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email)')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009');

  if (membersError) {
    console.log(`Error: ${membersError.message}`);
  } else if (origMembers) {
    console.log(`Found ${origMembers.length} members:`);
    origMembers.forEach(m => {
      console.log(`  - ${m.users?.email || m.user_id} (${m.role})`);
    });
  } else {
    console.log('No members found');
  }

  // 2. Check all workspace_members
  console.log('\n═══════════════════════════════════════════════════');
  console.log('2. ALL workspace members in database:\n');

  const { data: allMembers } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .order('workspace_id');

  console.log(`Total members: ${allMembers?.length || 0}`);

  // 3. Check workspace_accounts
  console.log('\n═══════════════════════════════════════════════════');
  console.log('3. LinkedIn accounts distribution:\n');

  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('workspace_id, unipile_account_id, account_name, workspaces(name)')
    .eq('provider', 'linkedin');

  if (accounts && accounts.length > 0) {
    accounts.forEach(acc => {
      console.log(`${acc.workspaces?.name || acc.workspace_id}: ${acc.account_name || acc.unipile_account_id}`);
    });
  } else {
    console.log('No LinkedIn accounts found');
  }

  // 4. Check campaigns
  console.log('\n═══════════════════════════════════════════════════');
  console.log('4. Campaign distribution:\n');

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('workspace_id, name, created_by, workspaces(name)')
    .order('workspace_id');

  if (campaigns && campaigns.length > 0) {
    const byWorkspace = {};
    campaigns.forEach(c => {
      const wsName = c.workspaces?.name || c.workspace_id;
      if (!byWorkspace[wsName]) byWorkspace[wsName] = [];
      byWorkspace[wsName].push(c.name);
    });

    Object.entries(byWorkspace).forEach(([ws, camps]) => {
      console.log(`${ws}: ${camps.length} campaigns`);
    });
  } else {
    console.log('No campaigns found');
  }

  // 5. Check if service accounts exist
  console.log('\n═══════════════════════════════════════════════════');
  console.log('5. Service account users:\n');

  const adminEmails = [];
  for (let i = 1; i <= 6; i++) {
    adminEmails.push(`admin${i}@innovareai.com`);
  }

  const { data: { users } } = await supabase.auth.admin.listUsers();
  const adminUsers = users.filter(u => adminEmails.includes(u.email));

  console.log(`Found ${adminUsers.length} admin service accounts:`);
  adminUsers.forEach(u => {
    console.log(`  - ${u.email} (${u.id})`);
  });

  console.log('\n═══════════════════════════════════════════════════');
  console.log('DIAGNOSIS:\n');

  if (!origMembers || origMembers.length === 0) {
    console.log('⚠️  Original workspace has NO members - DELETE statement worked');
  }

  if (!allMembers || allMembers.length === 0) {
    console.log('❌ NO workspace members exist anywhere - INSERT statements FAILED');
    console.log('   Possible causes:');
    console.log('   - RLS policies blocking inserts');
    console.log('   - Foreign key constraint failures');
    console.log('   - User IDs don\'t exist');
  }

  if (adminUsers.length < 6) {
    console.log(`❌ Only ${adminUsers.length}/6 service accounts created`);
  }
}

checkWhatWentWrong().catch(console.error);
