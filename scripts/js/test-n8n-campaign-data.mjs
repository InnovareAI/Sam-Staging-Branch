#!/usr/bin/env node
/**
 * Test N8N Campaign Data Structure
 * Verifies that the N8N webhook receives correct account data from workspace_accounts table
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🧪 Testing N8N Campaign Data Structure\n');

// Get InnovareAI workspace (Michelle's workspace)
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log(`📁 Workspace ID: ${workspaceId}\n`);

// Fetch workspace accounts (same query as the N8N route)
console.log('1️⃣ Fetching workspace accounts...');
const accountsRes = await fetch(
  `${SUPABASE_URL}/rest/v1/workspace_accounts?select=*&workspace_id=eq.${workspaceId}&is_active=eq.true`,
  { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
);

const workspaceAccounts = await accountsRes.json();

console.log(`   ✅ Found ${workspaceAccounts.length} active account(s)\n`);

// Separate LinkedIn and email accounts (same logic as the route)
const linkedinAccounts = workspaceAccounts.filter(acc => acc.account_type === 'linkedin');
const emailAccounts = workspaceAccounts.filter(acc => acc.account_type === 'email');

console.log(`   📊 LinkedIn accounts: ${linkedinAccounts.length}`);
console.log(`   📊 Email accounts: ${emailAccounts.length}\n`);

// Format accounts (same as the route)
const linkedinAccountsFormatted = linkedinAccounts.map(acc => ({
  id: acc.id,
  unipile_account_id: acc.unipile_account_id,
  account_name: acc.account_name,
  status: acc.connection_status,
  is_active: acc.is_active,
  daily_limit: acc.daily_message_limit || 20,
  messages_sent_today: acc.messages_sent_today || 0
}));

const emailAccountsFormatted = emailAccounts.map(acc => ({
  id: acc.id,
  unipile_account_id: acc.unipile_account_id,
  account_name: acc.account_name,
  status: acc.connection_status,
  is_active: acc.is_active
}));

console.log('2️⃣ Formatted LinkedIn Accounts for N8N:\n');
console.log(JSON.stringify(linkedinAccountsFormatted, null, 2));

if (emailAccountsFormatted.length > 0) {
  console.log('\n3️⃣ Formatted Email Accounts for N8N:\n');
  console.log(JSON.stringify(emailAccountsFormatted, null, 2));
}

// Build integration config (same as route)
const integrationConfig = {
  instance_url: process.env.UNIPILE_DSN || '',
  linkedin_accounts: linkedinAccountsFormatted,
  email_accounts: emailAccountsFormatted,
  rate_limits: {},
  current_usage: {},
  oauth_status: 'connected'
};

console.log('\n4️⃣ Final Integration Config for N8N:\n');
console.log(JSON.stringify(integrationConfig, null, 2));

// Validation
console.log('\n' + '━'.repeat(80));
console.log('✅ VALIDATION CHECKS');
console.log('━'.repeat(80));

const checks = [
  {
    name: 'At least one LinkedIn account',
    pass: linkedinAccountsFormatted.length > 0,
    value: linkedinAccountsFormatted.length
  },
  {
    name: 'All accounts have Unipile account ID',
    pass: linkedinAccountsFormatted.every(acc => acc.unipile_account_id),
    value: linkedinAccountsFormatted.filter(acc => acc.unipile_account_id).length + '/' + linkedinAccountsFormatted.length
  },
  {
    name: 'All accounts have status "connected"',
    pass: linkedinAccountsFormatted.every(acc => acc.status === 'connected'),
    value: linkedinAccountsFormatted.filter(acc => acc.status === 'connected').length + '/' + linkedinAccountsFormatted.length
  },
  {
    name: 'All accounts have daily limits',
    pass: linkedinAccountsFormatted.every(acc => acc.daily_limit > 0),
    value: 'Limits: ' + linkedinAccountsFormatted.map(acc => acc.daily_limit).join(', ')
  },
  {
    name: 'Instance URL configured',
    pass: integrationConfig.instance_url && integrationConfig.instance_url.length > 0,
    value: integrationConfig.instance_url ? 'Set' : 'Missing'
  }
];

checks.forEach(check => {
  const icon = check.pass ? '✅' : '❌';
  console.log(`${icon} ${check.name}: ${check.value}`);
});

console.log('\n' + '━'.repeat(80));

if (checks.every(c => c.pass)) {
  console.log('🎉 ALL CHECKS PASSED! N8N workflow will receive correct data structure.');
} else {
  console.log('⚠️  SOME CHECKS FAILED. Review configuration before running campaign.');
}

console.log('━'.repeat(80));
console.log('\n💡 Next Steps:');
console.log('   1. Verify N8N workflow is active at: https://innovareai.app.n8n.cloud');
console.log('   2. Test campaign execution with 1 prospect');
console.log('   3. Check N8N execution logs for account data');
console.log('   4. Verify message appears in LinkedIn\n');
