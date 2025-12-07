import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 DIAGNOSING QA-MONITOR ISSUES\n');

// ============================================
// ISSUE 1: Stuck Upload Session
// ============================================
console.log('📋 Issue 1: Stuck Upload Session');

const { data: stuckSessions } = await supabase
  .from('prospect_upload_sessions')
  .select('*')
  .eq('status', 'processing')
  .order('created_at', { ascending: false })
  .limit(5);

console.log(`\nFound ${stuckSessions?.length || 0} stuck sessions:`);
for (const session of stuckSessions || []) {
  console.log(`\n  Session: ${session.id.substring(0, 8)}`);
  console.log(`  Created: ${new Date(session.created_at).toLocaleString()}`);
  console.log(`  Total: ${session.total_prospects}`);
  console.log(`  Valid: ${session.valid_prospects}`);
  console.log(`  Invalid: ${session.invalid_prospects}`);
  console.log(`  Status: ${session.status}`);

  // Count actual prospects for this session
  const { count: actualCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('upload_session_id', session.id);

  console.log(`  Actual prospects in DB: ${actualCount}`);
  console.log(`  Mismatch: ${session.total_prospects - (actualCount || 0)} missing`);
}

// ============================================
// ISSUE 2: Missing Workspace Account Sync
// ============================================
console.log('\n\n📋 Issue 2: Missing Workspace Account Sync');

// Get all LinkedIn accounts from user_unipile_accounts
const { data: linkedinAccounts } = await supabase
  .from('user_unipile_accounts')
  .select('id, account_id, user_id, provider, display_name, workspace_id')
  .eq('provider', 'LINKEDIN');

console.log(`\nFound ${linkedinAccounts?.length || 0} LinkedIn accounts in user_unipile_accounts`);

// Check which are NOT in workspace_accounts
const missingAccounts = [];
for (const account of linkedinAccounts || []) {
  const { data: workspaceAccount } = await supabase
    .from('workspace_accounts')
    .select('id')
    .eq('account_id', account.account_id)
    .single();

  if (!workspaceAccount) {
    missingAccounts.push(account);
    console.log(`\n  ❌ Missing: ${account.display_name}`);
    console.log(`     Account ID: ${account.account_id}`);
    console.log(`     User ID: ${account.user_id}`);
    console.log(`     Workspace ID: ${account.workspace_id || 'NULL'}`);
  }
}

console.log(`\n  Total missing: ${missingAccounts.length}`);

// ============================================
// ISSUE 3: Stuck Prospects
// ============================================
console.log('\n\n📋 Issue 3: Stuck Prospects (>3 days)');

const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

const { data: stuckProspects } = await supabase
  .from('campaign_prospects')
  .select('id, name, status, created_at, workspace_id, campaign_id, approval_status')
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

// FIX 1: Stuck Upload Sessions
console.log('Fix 1: Marking stuck sessions as completed...');
let fix1Count = 0;
for (const session of stuckSessions || []) {
  const { count: actualCount } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('upload_session_id', session.id);

  // Update session to completed with correct counts
  const { error } = await supabase
    .from('prospect_upload_sessions')
    .update({
      status: 'completed',
      total_prospects: actualCount || 0,
      valid_prospects: actualCount || 0,
      invalid_prospects: 0
    })
    .eq('id', session.id);

  if (!error) {
    console.log(`  ✅ Fixed session ${session.id.substring(0, 8)}: ${actualCount} prospects`);
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
  // Get user's workspace if not set
  let workspaceId = account.workspace_id;

  if (!workspaceId) {
    // Get first workspace for this user
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', account.user_id)
      .limit(1)
      .single();

    workspaceId = membership?.workspace_id;
  }

  if (!workspaceId) {
    console.log(`  ⚠️  Skipping ${account.display_name}: No workspace found`);
    continue;
  }

  // Insert into workspace_accounts
  const { error } = await supabase
    .from('workspace_accounts')
    .insert({
      workspace_id: workspaceId,
      account_id: account.account_id,
      provider: 'LINKEDIN',
      display_name: account.display_name,
      status: 'active',
      is_primary: false
    });

  if (!error) {
    console.log(`  ✅ Synced ${account.display_name} to workspace ${workspaceId.substring(0, 8)}`);
    fix2Count++;
  } else if (error.code === '23505') {
    console.log(`  ℹ️  ${account.display_name} already exists (duplicate key)`);
  } else {
    console.error(`  ❌ Error syncing ${account.display_name}:`, error.message);
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
console.log(`✅ Stuck sessions fixed: ${fix1Count}`);
console.log(`✅ Accounts synced: ${fix2Count}`);
console.log(`✅ Prospects fixed: ${fix3Count}`);
console.log('='.repeat(60));
console.log('\n');
