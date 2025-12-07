import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 DIAGNOSING QA-MONITOR ISSUES (V2 - Correct Tables)\n');

// ============================================
// ISSUE 1: Stuck Approval Sessions
// ============================================
console.log('📋 Issue 1: Stuck Approval Sessions (prospect_approval_sessions)');

const { data: stuckSessions } = await supabase
  .from('prospect_approval_sessions')
  .select('id, campaign_id, workspace_id, status, approved_count, pending_count, total_prospects, created_at')
  .in('status', ['active', 'pending'])
  .gt('total_prospects', 0)
  .order('created_at', { ascending: false });

console.log(`\nFound ${stuckSessions?.length || 0} approval sessions with potential issues:`);

const sessionsWithIssues = [];
for (const session of stuckSessions || []) {
  // Count actual prospects
  const { count: totalCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('approval_session_id', session.id);

  const { count: approvedCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('approval_session_id', session.id)
    .eq('approval_status', 'approved');

  const { count: pendingCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('approval_session_id', session.id)
    .eq('approval_status', 'pending');

  const mismatch = session.total_prospects !== totalCount ||
                   session.approved_count !== approvedCount ||
                   session.pending_count !== pendingCount;

  const missing = session.total_prospects - totalCount;

  if (mismatch || missing > 0) {
    sessionsWithIssues.push({
      session,
      actual: { total: totalCount, approved: approvedCount, pending: pendingCount },
      recorded: { total: session.total_prospects, approved: session.approved_count, pending: session.pending_count },
      missing
    });

    console.log(`\n  ❌ Session ${session.id.substring(0, 8)} (${session.status})`);
    console.log(`     Created: ${new Date(session.created_at).toLocaleString()}`);
    console.log(`     Recorded: ${session.total_prospects} total, ${session.approved_count} approved, ${session.pending_count} pending`);
    console.log(`     Actual:   ${totalCount} total, ${approvedCount} approved, ${pendingCount} pending`);
    console.log(`     Missing:  ${missing} prospects`);
  }
}

console.log(`\n  Total sessions with issues: ${sessionsWithIssues.length}`);

// ============================================
// ISSUE 2: Missing Workspace Accounts
// ============================================
console.log('\n\n📋 Issue 2: Missing Workspace Accounts (Correct Query)');

// Get all LinkedIn accounts from user_unipile_accounts
const { data: userAccounts } = await supabase
  .from('user_unipile_accounts')
  .select('user_id, unipile_account_id, account_name, platform, connection_status')
  .eq('platform', 'LINKEDIN')
  .in('connection_status', ['active', 'connected']);

console.log(`\nFound ${userAccounts?.length || 0} active/connected LinkedIn accounts in user_unipile_accounts`);

// Get all workspace accounts
const { data: workspaceAccounts } = await supabase
  .from('workspace_accounts')
  .select('unipile_account_id');

const workspaceAccountIds = new Set((workspaceAccounts || []).map(a => a.unipile_account_id));

// Find missing
const missingAccounts = (userAccounts || []).filter(a => !workspaceAccountIds.has(a.unipile_account_id));

console.log(`\nAccounts NOT in workspace_accounts: ${missingAccounts.length}`);
for (const account of missingAccounts) {
  console.log(`\n  ❌ Missing: ${account.account_name || 'Unknown'}`);
  console.log(`     Unipile Account ID: ${account.unipile_account_id}`);
  console.log(`     User ID: ${account.user_id}`);
  console.log(`     Status: ${account.connection_status}`);

  // Get user's workspaces
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .eq('user_id', account.user_id);

  if (memberships && memberships.length > 0) {
    console.log(`     Workspaces: ${memberships.map(m => m.workspaces?.name || 'Unknown').join(', ')}`);
  } else {
    console.log(`     ⚠️  No workspace memberships found`);
  }
}

// ============================================
// ISSUE 3: Stuck Prospects (>3 days)
// ============================================
console.log('\n\n📋 Issue 3: Stuck Prospects (>3 days in transitional status)');

const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

const { data: stuckProspects } = await supabase
  .from('campaign_prospects')
  .select('id, name, status, approval_status, created_at, workspace_id, campaign_id')
  .in('status', ['uploading', 'validating', 'processing'])
  .lt('created_at', threeDaysAgo.toISOString())
  .order('created_at', { ascending: true })
  .limit(10);

console.log(`\nFound ${stuckProspects?.length || 0} stuck prospects:`);
for (const prospect of stuckProspects || []) {
  const daysStuck = Math.floor((Date.now() - new Date(prospect.created_at).getTime()) / (1000 * 60 * 60 * 24));
  console.log(`\n  ${prospect.name || 'Unknown'} (${prospect.id.substring(0, 8)})`);
  console.log(`    Status: ${prospect.status}`);
  console.log(`    Approval: ${prospect.approval_status || 'NULL'}`);
  console.log(`    Stuck for: ${daysStuck} days`);
  console.log(`    Campaign: ${prospect.campaign_id?.substring(0, 8) || 'NULL'}`);
}

// ============================================
// FIXES
// ============================================
console.log('\n\n🔧 APPLYING FIXES\n');

// FIX 1: Stuck Approval Sessions
console.log('Fix 1: Fixing stuck approval sessions...');
let fix1Count = 0;
for (const issue of sessionsWithIssues) {
  const { session, actual } = issue;

  // Update session with correct counts
  const { error } = await supabase
    .from('prospect_approval_sessions')
    .update({
      total_prospects: actual.total,
      approved_count: actual.approved,
      pending_count: actual.pending,
      // If all are approved/rejected, mark as completed
      status: actual.pending === 0 ? 'completed' : session.status
    })
    .eq('id', session.id);

  if (!error) {
    console.log(`  ✅ Fixed session ${session.id.substring(0, 8)}: ${actual.total} total (${actual.approved} approved, ${actual.pending} pending)`);
    fix1Count++;
  } else {
    console.error(`  ❌ Error fixing session ${session.id.substring(0, 8)}:`, error.message);
  }
}
console.log(`\nFixed ${fix1Count} stuck sessions`);

// FIX 2: Sync Missing Workspace Accounts
console.log('\nFix 2: Syncing missing workspace accounts...');
let fix2Count = 0;
for (const account of missingAccounts) {
  // Get user's first workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', account.user_id)
    .limit(1)
    .single();

  if (!membership) {
    console.log(`  ⚠️  Skipping ${account.account_name}: No workspace membership`);
    continue;
  }

  // Insert into workspace_accounts
  const { error } = await supabase
    .from('workspace_accounts')
    .insert({
      workspace_id: membership.workspace_id,
      unipile_account_id: account.unipile_account_id,
      provider: 'LINKEDIN',
      display_name: account.account_name,
      status: 'active',
      is_primary: false
    });

  if (!error) {
    console.log(`  ✅ Synced ${account.account_name} to workspace ${membership.workspace_id.substring(0, 8)}`);
    fix2Count++;
  } else if (error.code === '23505') {
    console.log(`  ℹ️  ${account.account_name} already exists (duplicate key)`);
  } else {
    console.error(`  ❌ Error syncing ${account.account_name}:`, error.message);
  }
}
console.log(`\nSynced ${fix2Count} missing accounts`);

// FIX 3: Stuck Prospects
console.log('\nFix 3: Fixing stuck prospects...');
let fix3Count = 0;
for (const prospect of stuckProspects || []) {
  // Determine correct final status
  let newStatus = 'pending_approval';
  if (prospect.approval_status === 'approved') {
    newStatus = 'approved';
  } else if (prospect.approval_status === 'rejected') {
    newStatus = 'rejected';
  }

  const { error } = await supabase
    .from('campaign_prospects')
    .update({
      status: newStatus
    })
    .eq('id', prospect.id);

  if (!error) {
    console.log(`  ✅ Fixed ${prospect.name || 'Unknown'}: ${prospect.status} → ${newStatus}`);
    fix3Count++;
  } else {
    console.error(`  ❌ Error fixing ${prospect.name}:`, error.message);
  }
}
console.log(`\nFixed ${fix3Count} stuck prospects`);

// ============================================
// SUMMARY
// ============================================
console.log('\n\n📊 SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Approval sessions fixed: ${fix1Count}`);
console.log(`✅ Accounts synced: ${fix2Count}`);
console.log(`✅ Prospects fixed: ${fix3Count}`);
console.log('='.repeat(60));
console.log('\n');
