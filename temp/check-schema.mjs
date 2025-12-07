import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 CHECKING DATABASE SCHEMA\n');

// Check campaign_prospects columns
console.log('📋 campaign_prospects columns:');
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .limit(1);

if (prospects && prospects.length > 0) {
  const columns = Object.keys(prospects[0]);
  console.log(`  Found ${columns.length} columns:`);
  for (const col of columns.sort()) {
    console.log(`    - ${col}`);
  }
  const hasApprovalSessionId = columns.includes('approval_session_id');
  console.log(`\n  ✅ Has approval_session_id column: ${hasApprovalSessionId}`);
}

// Check workspace_accounts columns
console.log('\n📋 workspace_accounts columns:');
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('*')
  .limit(1);

if (accounts && accounts.length > 0) {
  const columns = Object.keys(accounts[0]);
  console.log(`  Found ${columns.length} columns:`);
  for (const col of columns.sort()) {
    console.log(`    - ${col}`);
  }
} else {
  console.log('  No records found in workspace_accounts');
}

// Check if Irish Maguad's user actually exists
console.log('\n📋 Irish Maguad user check:');
const { data: user } = await supabase
  .from('users')
  .select('id, email')
  .eq('id', '83935b70-8067-4b2f-9206-3cad5ce8746b')
  .single();

if (user) {
  console.log(`  ✅ User exists: ${user.email}`);

  // Check workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(name)')
    .eq('user_id', user.id);

  console.log(`  Workspace memberships: ${memberships?.length || 0}`);
  for (const m of memberships || []) {
    console.log(`    - ${m.workspaces?.name || 'Unknown'} (${m.role})`);
  }
} else {
  console.log('  ❌ User not found in users table');
}

console.log('\n');
