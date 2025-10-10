#!/usr/bin/env node

/**
 * Delete Test Users Script
 * Safely removes test user accounts with backup
 */

require('dotenv').config({ path: '.env.local', override: true });
const { createClient } = require('@supabase/supabase-js');

// Test user email patterns to delete (email aliases only)
const TEST_USER_EMAILS = [
  'tl+2@chillmine.io',
  'tl+10@innovareai.com',
  'tl+15@innvoareai.com'  // typo in domain
];

async function deleteTestUsers() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('🗑️  Test User Deletion Script\n');
  console.log('⚠️  WARNING: This will permanently delete the following accounts:\n');

  // Get test users
  const { data: testUsers, error: fetchError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
    .in('email', TEST_USER_EMAILS);

  if (fetchError) {
    console.error('❌ Error fetching test users:', fetchError);
    return;
  }

  if (testUsers.length === 0) {
    console.log('✅ No test users found to delete\n');
    return;
  }

  console.log(`📋 Users to be deleted (${testUsers.length}):\n`);
  testUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`);
    console.log(`   Name: ${user.first_name || 'N/A'} ${user.last_name || 'N/A'}`);
    console.log(`   ID: ${user.id}\n`);
  });

  // Get related data counts
  const userIds = testUsers.map(u => u.id);

  const { count: membershipsCount } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);

  const { count: accountsCount } = await supabase
    .from('workspace_accounts')
    .select('*', { count: 'exact', head: true })
    .in('user_id', userIds);

  console.log('📊 Related data to be deleted:');
  console.log(`   - Workspace memberships: ${membershipsCount || 0}`);
  console.log(`   - Workspace accounts: ${accountsCount || 0}\n`);

  console.log('🔄 Creating backup before deletion...\n');

  // Backup to Airtable
  const { backupToAirtable } = require('./backup-to-airtable.cjs');
  await backupToAirtable('Before deleting test users');

  console.log('\n✅ Backup complete\n');
  console.log('🗑️  Proceeding with deletion...\n');

  // Delete workspace_members first (foreign key constraint)
  const { error: membersError } = await supabase
    .from('workspace_members')
    .delete()
    .in('user_id', userIds);

  if (membersError) {
    console.error('❌ Error deleting workspace memberships:', membersError);
    return;
  }
  console.log(`✅ Deleted ${membershipsCount || 0} workspace memberships`);

  // Delete workspace_accounts
  const { error: accountsError } = await supabase
    .from('workspace_accounts')
    .delete()
    .in('user_id', userIds);

  if (accountsError) {
    console.error('❌ Error deleting workspace accounts:', accountsError);
    return;
  }
  console.log(`✅ Deleted ${accountsCount || 0} workspace accounts`);

  // Delete users
  const { error: usersError } = await supabase
    .from('users')
    .delete()
    .in('id', userIds);

  if (usersError) {
    console.error('❌ Error deleting users:', usersError);
    return;
  }

  console.log(`✅ Deleted ${testUsers.length} test users\n`);

  // Show remaining users
  const { data: remainingUsers } = await supabase
    .from('users')
    .select('email')
    .order('created_at', { ascending: false });

  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Test User Deletion Complete');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`📊 Remaining users: ${remainingUsers?.length || 0}\n`);

  if (remainingUsers && remainingUsers.length > 0) {
    console.log('👥 Remaining users:');
    remainingUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email}`);
    });
  }

  console.log('\n💾 Backup saved to Airtable: https://airtable.com/' + process.env.AIRTABLE_BASE_ID);
  console.log('');
}

// Require confirmation
const args = process.argv.slice(2);
if (args[0] !== '--confirm') {
  console.log('⚠️  This script will DELETE test users and related data.');
  console.log('');
  console.log('To proceed, run:');
  console.log('  node scripts/delete-test-users.cjs --confirm');
  console.log('');
  process.exit(0);
}

deleteTestUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
