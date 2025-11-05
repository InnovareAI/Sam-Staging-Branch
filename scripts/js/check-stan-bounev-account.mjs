import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 Checking Stan Bounev\'s LinkedIn account...\n');

// 1. Find Stan Bounev's user
const { data: users, error: userError } = await supabase
  .from('users')
  .select('id, email')
  .or('email.ilike.%bounev%,email.ilike.%stan%');

if (userError) {
  console.error('❌ Error finding user:', userError);
  process.exit(1);
}

console.log('👤 Found users:');
users.forEach(u => {
  console.log(`  - ${u.email} - ID: ${u.id}`);
});

if (users.length === 0) {
  console.log('❌ No users found matching "bounev" or "stan"');
  process.exit(1);
}

// Use first user (should be Stan)
const stanUser = users[0];
console.log(`\n✅ Using: ${stanUser.email}\n`);

// 2. Find Stan's workspace memberships
const { data: memberships, error: memberError } = await supabase
  .from('workspace_members')
  .select('workspace_id, role')
  .eq('user_id', stanUser.id);

if (memberError) {
  console.error('❌ Error finding memberships:', memberError);
  process.exit(1);
}

// Get workspace names separately
const workspaceIds = memberships.map(m => m.workspace_id);
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name')
  .in('id', workspaceIds);

const workspaceMap = Object.fromEntries(workspaces.map(w => [w.id, w.name]));

// Add workspace names to memberships
const enrichedMemberships = memberships.map(m => ({
  ...m,
  workspace_name: workspaceMap[m.workspace_id] || 'Unknown'
}));

console.log('🏢 Workspaces:');
enrichedMemberships.forEach(m => {
  console.log(`  - ${m.workspace_name} (${m.workspace_id}) - Role: ${m.role}`);
});

if (memberships.length === 0) {
  console.log('❌ No workspace memberships found');
  process.exit(1);
}

// 3. Check LinkedIn accounts for each workspace
console.log('\n🔗 LinkedIn Accounts:\n');

async function checkAndUpdateAccounts() {
  for (const membership of enrichedMemberships) {
    console.log(`Workspace: ${membership.workspace_name}`);

    const { data: accounts, error: accountError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .eq('account_type', 'linkedin');

    if (accountError) {
      console.error(`  ❌ Error: ${accountError.message}`);
      continue;
    }

    if (accounts.length === 0) {
      console.log('  ⚠️ No LinkedIn accounts found');
      continue;
    }

    for (const acc of accounts) {
      console.log(`  📋 Account Details:`);
      console.log(`     ID: ${acc.id}`);
      console.log(`     Account Name: ${acc.account_name || 'N/A'}`);
      console.log(`     Unipile Account ID: ${acc.unipile_account_id || '❌ MISSING'}`);
      console.log(`     Connection Status: ${acc.connection_status || 'unknown'}`);
      console.log(`     User ID: ${acc.user_id}`);
      console.log(`     Created: ${acc.created_at}`);
      console.log(`     Updated: ${acc.updated_at}`);

      // Check if this is Stan's account
      if (acc.user_id === stanUser.id) {
        console.log(`     ✅ This is Stan's account`);

        // Check if Unipile ID needs updating
        const expectedUnipileId = '4Vv6oZ73RvarImDN6iYbbg';
        if (acc.unipile_account_id !== expectedUnipileId) {
          console.log(`\n     ⚠️ UNIPILE ID MISMATCH!`);
          console.log(`        Current: ${acc.unipile_account_id || 'NULL'}`);
          console.log(`        Expected: ${expectedUnipileId}`);
          console.log(`\n     🔧 Updating now...`);

          // Update the account
          const { error: updateError } = await supabase
            .from('workspace_accounts')
            .update({
              unipile_account_id: expectedUnipileId,
              connection_status: 'connected',
              updated_at: new Date().toISOString()
            })
            .eq('id', acc.id);

          if (updateError) {
            console.error(`     ❌ Update failed:`, updateError);
          } else {
            console.log(`     ✅ Successfully updated Unipile ID to: ${expectedUnipileId}`);
            console.log(`     ✅ Connection status set to: connected`);
          }
        } else {
          console.log(`     ✅ Unipile ID is correct: ${expectedUnipileId}`);
        }
      }
    }

    console.log('');
  }
}

await checkAndUpdateAccounts();

// 4. Final verification
console.log('\n🔄 Final Verification:\n');

async function finalVerification() {
  for (const membership of enrichedMemberships) {
    const { data: finalAccounts } = await supabase
      .from('workspace_accounts')
      .select('account_name, unipile_account_id, connection_status')
      .eq('workspace_id', membership.workspace_id)
      .eq('user_id', stanUser.id)
      .eq('account_type', 'linkedin');

    if (finalAccounts && finalAccounts.length > 0) {
      for (const acc of finalAccounts) {
        const status = acc.unipile_account_id === '4Vv6oZ73RvarImDN6iYbbg' && acc.connection_status === 'connected'
          ? '✅ READY'
          : '❌ NOT READY';

        console.log(`${status} - ${membership.workspace_name}`);
        console.log(`  Account: ${acc.account_name || 'N/A'}`);
        console.log(`  Unipile ID: ${acc.unipile_account_id}`);
        console.log(`  Status: ${acc.connection_status}\n`);
      }
    }
  }
}

await finalVerification();

console.log('✅ Done!');
