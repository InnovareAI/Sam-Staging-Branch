#!/usr/bin/env node
import 'dotenv/config';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Checking Michelle Account Setup\n');

// Check workspace_unipile_integrations
const res1 = await fetch(`${SUPABASE_URL}/rest/v1/workspace_unipile_integrations?select=*`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const integrations = await res1.json();
console.log('1️⃣ workspace_unipile_integrations:');
if (integrations.message) {
  console.log('  ❌ Table does not exist');
} else {
  console.log(`  Found ${integrations.length} integrations`);
  console.log(JSON.stringify(integrations, null, 2));
}

// Check user_unipile_accounts for Michelle
const res2 = await fetch(`${SUPABASE_URL}/rest/v1/user_unipile_accounts?select=*`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const userAccounts = await res2.json();
console.log('\n2️⃣ user_unipile_accounts:');
console.log(`  Found ${userAccounts.length} accounts`);
userAccounts.forEach(acc => {
  console.log(`    User: ${acc.user_id} | Unipile: ${acc.unipile_account_id}`);
});

// Check workspace_accounts for Michelle
const res3 = await fetch(`${SUPABASE_URL}/rest/v1/workspace_accounts?select=*`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const workspaceAccounts = await res3.json();
console.log('\n3️⃣ workspace_accounts (Michelle):');
const michelleAccounts = workspaceAccounts.filter(a => a.account_name?.toLowerCase().includes('michelle'));
if (michelleAccounts.length > 0) {
  console.log(JSON.stringify(michelleAccounts, null, 2));
} else {
  console.log('  ❌ No accounts found with "Michelle" in name');
}

// Get current user (assuming logged in as Michelle)
console.log('\n4️⃣ Finding Michelle user ID...');
const res4 = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const usersData = await res4.json();
const michelleUser = usersData.users?.find(u => u.email?.toLowerCase().includes('michelle'));
if (michelleUser) {
  console.log(`  ✅ Michelle's User ID: ${michelleUser.id}`);
  console.log(`  Email: ${michelleUser.email}`);

  // Get her Unipile account
  const michelleUnipile = userAccounts.find(a => a.user_id === michelleUser.id);
  if (michelleUnipile) {
    console.log(`  ✅ Unipile Account ID: ${michelleUnipile.unipile_account_id}`);
  }
}
