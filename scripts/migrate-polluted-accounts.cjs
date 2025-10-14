require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

/**
 * Migration Script: Move LinkedIn accounts to correct workspaces
 *
 * Problem: LinkedIn accounts ended up in wrong workspaces due to email matching bug
 * Solution: Move each account to the workspace where its user_id is actually a member
 */

async function migrateAccounts() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('🔍 CROSS-WORKSPACE ACCOUNT POLLUTION MIGRATION');
  console.log('═══════════════════════════════════════════════\n');

  // Step 1: Get all workspace_accounts with LinkedIn accounts
  console.log('📊 Step 1: Fetching all LinkedIn accounts...\n');

  const { data: allAccounts, error: accountsError } = await supabase
    .from('workspace_accounts')
    .select('id, workspace_id, user_id, account_name, account_identifier, unipile_account_id')
    .eq('account_type', 'linkedin');

  if (accountsError) {
    console.error('❌ Error fetching accounts:', accountsError);
    return;
  }

  console.log(`   Found ${allAccounts.length} total LinkedIn accounts\n`);

  // Step 2: For each account, check if user_id is member of its workspace
  console.log('📋 Step 2: Checking workspace membership...\n');

  const mismatches = [];

  for (const account of allAccounts) {
    // Check if user is member of this workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('workspace_id', account.workspace_id)
      .eq('user_id', account.user_id)
      .maybeSingle();

    if (memberError) {
      console.error(`   ⚠️  Error checking membership for account ${account.id}:`, memberError);
      continue;
    }

    if (!membership) {
      // User is NOT a member of this workspace - find their correct workspace
      const { data: correctWorkspace, error: workspaceError } = await supabase
        .from('workspace_members')
        .select('workspace_id, role, workspaces(name)')
        .eq('user_id', account.user_id)
        .maybeSingle();

      if (workspaceError) {
        console.error(`   ⚠️  Error finding correct workspace:`, workspaceError);
        continue;
      }

      // Get user email for logging
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', account.user_id)
        .single();

      // Get current workspace name
      const { data: currentWorkspace } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', account.workspace_id)
        .single();

      mismatches.push({
        account_id: account.id,
        account_name: account.account_name,
        user_email: user?.email || 'unknown',
        current_workspace_id: account.workspace_id,
        current_workspace_name: currentWorkspace?.name || 'unknown',
        correct_workspace_id: correctWorkspace?.workspace_id || null,
        correct_workspace_name: correctWorkspace?.workspaces?.name || null,
        user_id: account.user_id
      });
    }
  }

  console.log('═══════════════════════════════════════════════');
  console.log('           MISMATCHED ACCOUNTS FOUND');
  console.log('═══════════════════════════════════════════════\n');

  if (mismatches.length === 0) {
    console.log('✅ No mismatches found! All accounts are in correct workspaces.\n');
    return;
  }

  console.log(`Found ${mismatches.length} accounts in wrong workspaces:\n`);

  mismatches.forEach((m, idx) => {
    console.log(`${idx + 1}. ${m.account_name} (${m.user_email})`);
    console.log(`   CURRENT:  ${m.current_workspace_name} (${m.current_workspace_id})`);
    console.log(`   CORRECT:  ${m.correct_workspace_name || 'NO WORKSPACE!'} (${m.correct_workspace_id || 'N/A'})`);
    console.log('');
  });

  console.log('═══════════════════════════════════════════════\n');

  // Step 3: Check for orphaned users (accounts with no workspace at all)
  const orphaned = mismatches.filter(m => !m.correct_workspace_id);

  if (orphaned.length > 0) {
    console.log('⚠️  WARNING: The following users have LinkedIn accounts but are NOT members of ANY workspace:');
    console.log('');
    orphaned.forEach(o => {
      console.log(`   - ${o.account_name} (${o.user_email})`);
    });
    console.log('');
    console.log('   These accounts cannot be migrated automatically.');
    console.log('   Action needed: Create workspaces for these users or add them to existing workspaces.\n');
  }

  // Step 4: Perform migration if --confirm flag is present
  const shouldConfirm = process.argv.includes('--confirm');

  const migratable = mismatches.filter(m => m.correct_workspace_id);

  if (migratable.length === 0) {
    console.log('❌ No accounts can be migrated (all are orphaned).\n');
    return;
  }

  if (!shouldConfirm) {
    console.log(`⚠️  Ready to migrate ${migratable.length} account(s).`);
    console.log('');
    console.log('To proceed with migration, run:');
    console.log('   node scripts/migrate-polluted-accounts.cjs --confirm');
    console.log('');
    return;
  }

  // Perform migration
  console.log('🚀 STARTING MIGRATION...\n');

  let successCount = 0;
  let failureCount = 0;

  for (const mismatch of migratable) {
    console.log(`Migrating: ${mismatch.account_name}`);
    console.log(`   From: ${mismatch.current_workspace_name}`);
    console.log(`   To:   ${mismatch.correct_workspace_name}`);

    const { error: updateError } = await supabase
      .from('workspace_accounts')
      .update({ workspace_id: mismatch.correct_workspace_id })
      .eq('id', mismatch.account_id);

    if (updateError) {
      console.log(`   ❌ Failed: ${updateError.message}\n`);
      failureCount++;
    } else {
      console.log(`   ✅ Migrated successfully\n`);
      successCount++;
    }
  }

  console.log('═══════════════════════════════════════════════');
  console.log('           MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════\n');
  console.log(`✅ Successfully migrated: ${successCount}`);
  console.log(`❌ Failed to migrate: ${failureCount}`);
  console.log(`⚠️  Orphaned (no workspace): ${orphaned.length}`);
  console.log('');

  if (successCount > 0) {
    console.log('🎉 Migration complete! Accounts have been moved to correct workspaces.\n');
  }
}

// Run migration
migrateAccounts()
  .then(() => {
    console.log('Script complete.');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
