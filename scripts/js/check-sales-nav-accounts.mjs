#!/usr/bin/env node
/**
 * Check Which Accounts Have Sales Navigator Enabled
 * Verifies Unipile recognizes premium features correctly
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

console.log('🔍 Checking LinkedIn Accounts for Sales Navigator\n');

const unipileDSN = process.env.UNIPILE_DSN;
const unipileApiKey = process.env.UNIPILE_API_KEY;

const accountsUrl = unipileDSN.includes('.')
  ? `https://${unipileDSN}/api/v1/accounts`
  : `https://${unipileDSN}.unipile.com:13443/api/v1/accounts`;

console.log(`Fetching: ${accountsUrl}\n`);

const response = await fetch(accountsUrl, {
  headers: {
    'X-API-KEY': unipileApiKey,
    'Accept': 'application/json'
  }
});

if (!response.ok) {
  console.error(`❌ API Error: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const data = await response.json();
const allAccounts = Array.isArray(data) ? data : (data.items || data.accounts || []);
const linkedInAccounts = allAccounts.filter(acc => acc.type === 'LINKEDIN');

console.log(`📊 Total LinkedIn accounts: ${linkedInAccounts.length}\n`);

// Target accounts
const targetAccounts = ['michelle', 'charissa', 'irish', 'noriko'];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 PREMIUM ACCOUNTS CHECK:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const account of linkedInAccounts) {
  const email = account.connection_params?.im?.email || account.connection_params?.im?.username || 'unknown';
  const name = account.name || email;

  // Check if this is one of our target premium accounts
  const isTarget = targetAccounts.some(target =>
    name.toLowerCase().includes(target) || email.toLowerCase().includes(target)
  );

  if (!isTarget && linkedInAccounts.length > 10) {
    continue; // Skip non-target accounts if we have many
  }

  console.log(`📧 ${name}`);
  console.log(`   Email: ${email}`);
  console.log(`   Account ID: ${account.id}`);
  console.log(`   Status: ${account.status || 'active'}`);

  const premiumFeatures = account.connection_params?.im?.premiumFeatures || [];

  if (premiumFeatures.length > 0) {
    console.log(`   ✅ Premium Features: ${premiumFeatures.join(', ')}`);

    if (premiumFeatures.includes('sales_navigator')) {
      console.log(`   🎯 SALES NAVIGATOR ENABLED`);
    } else if (premiumFeatures.includes('recruiter')) {
      console.log(`   🎯 RECRUITER ENABLED`);
    } else if (premiumFeatures.includes('premium')) {
      console.log(`   💎 PREMIUM (Career/Business)`);
    }
  } else {
    console.log(`   ⚠️  No premium features detected - CLASSIC ACCOUNT`);
    console.log(`   🔍 This account will use Classic LinkedIn API`);
  }

  // Show full connection params for debugging
  if (isTarget) {
    console.log(`   📋 Full params:`, JSON.stringify(account.connection_params?.im, null, 2));
  }

  console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 SUMMARY:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const salesNavCount = linkedInAccounts.filter(acc =>
  (acc.connection_params?.im?.premiumFeatures || []).includes('sales_navigator')
).length;

const recruiterCount = linkedInAccounts.filter(acc =>
  (acc.connection_params?.im?.premiumFeatures || []).includes('recruiter')
).length;

const premiumCount = linkedInAccounts.filter(acc =>
  (acc.connection_params?.im?.premiumFeatures || []).includes('premium')
).length;

const classicCount = linkedInAccounts.filter(acc =>
  (acc.connection_params?.im?.premiumFeatures || []).length === 0
).length;

console.log(`🎯 Sales Navigator: ${salesNavCount} accounts`);
console.log(`🎯 Recruiter: ${recruiterCount} accounts`);
console.log(`💎 Premium (Career/Business): ${premiumCount} accounts`);
console.log(`📋 Classic (Free): ${classicCount} accounts`);
console.log(`📊 Total: ${linkedInAccounts.length} accounts\n`);

if (salesNavCount === 0 && recruiterCount === 0) {
  console.log('⚠️  WARNING: No Sales Navigator or Recruiter accounts detected!');
  console.log('');
  console.log('This means all searches will use Classic LinkedIn API, which only returns:');
  console.log('  - Name, headline, location');
  console.log('  - NO company field');
  console.log('  - NO experience data');
  console.log('');
  console.log('Solutions:');
  console.log('1. Re-connect Michelle/Charissa/Irish accounts via Unipile OAuth');
  console.log('2. Verify they have active Sales Navigator subscriptions');
  console.log('3. Contact Unipile support if features not detected after reconnect');
  console.log('');
}

console.log('✅ Check complete\n');
