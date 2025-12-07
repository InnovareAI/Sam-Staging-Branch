import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🗑️  DELETING admin3@innovareai.com ACCOUNT\n');

const targetUserId = '83935b70-8067-4b2f-9206-3cad5ce8746b';
const targetEmail = 'admin3@innovareai.com';

// Step 1: Check what data exists for this user
console.log('📋 Step 1: Checking existing data...\n');

const { data: user } = await supabase
  .from('users')
  .select('id, email, created_at')
  .eq('id', targetUserId)
  .single();

if (!user) {
  console.log('✅ User already deleted or does not exist');
  process.exit(0);
}

console.log(`Found user: ${user.email} (created ${new Date(user.created_at).toLocaleDateString()})`);

// Check user_unipile_accounts
const { data: unipileAccounts } = await supabase
  .from('user_unipile_accounts')
  .select('id, unipile_account_id, account_name, platform')
  .eq('user_id', targetUserId);

console.log(`  - user_unipile_accounts: ${unipileAccounts?.length || 0} records`);
for (const acc of unipileAccounts || []) {
  console.log(`    • ${acc.platform}: ${acc.account_name} (${acc.unipile_account_id})`);
}

// Check workspace_members
const { data: memberships } = await supabase
  .from('workspace_members')
  .select('workspace_id, role')
  .eq('user_id', targetUserId);

console.log(`  - workspace_members: ${memberships?.length || 0} records`);

// Check campaign_prospects
const { count: prospectsCount } = await supabase
  .from('campaign_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('added_by', targetUserId);

console.log(`  - campaign_prospects (added_by): ${prospectsCount || 0} records`);

// Step 2: Delete data
console.log('\n🔧 Step 2: Deleting associated data...\n');

// Delete from user_unipile_accounts
if (unipileAccounts && unipileAccounts.length > 0) {
  const { error: unipileError } = await supabase
    .from('user_unipile_accounts')
    .delete()
    .eq('user_id', targetUserId);

  if (unipileError) {
    console.error(`  ❌ Error deleting user_unipile_accounts:`, unipileError.message);
  } else {
    console.log(`  ✅ Deleted ${unipileAccounts.length} user_unipile_accounts records`);
  }
}

// Delete from workspace_members
if (memberships && memberships.length > 0) {
  const { error: membersError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('user_id', targetUserId);

  if (membersError) {
    console.error(`  ❌ Error deleting workspace_members:`, membersError.message);
  } else {
    console.log(`  ✅ Deleted ${memberships.length} workspace_members records`);
  }
}

// Step 3: Delete user account
console.log('\n🗑️  Step 3: Deleting user account...\n');

const { error: userError } = await supabase
  .from('users')
  .delete()
  .eq('id', targetUserId);

if (userError) {
  console.error(`  ❌ Error deleting user:`, userError.message);
} else {
  console.log(`  ✅ Deleted user ${targetEmail}`);
}

// Step 4: Verify deletion
console.log('\n✓ Step 4: Verifying deletion...\n');

const { data: verifyUser } = await supabase
  .from('users')
  .select('id')
  .eq('id', targetUserId)
  .single();

if (!verifyUser) {
  console.log('✅ User successfully deleted');
} else {
  console.error('❌ User still exists in database');
}

const { data: verifyUnipile } = await supabase
  .from('user_unipile_accounts')
  .select('id')
  .eq('user_id', targetUserId);

console.log(`   Remaining user_unipile_accounts: ${verifyUnipile?.length || 0}`);

console.log('\n📊 DELETION COMPLETE\n');
