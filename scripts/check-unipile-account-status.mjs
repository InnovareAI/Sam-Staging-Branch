#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const UNIPILE_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg'; // Charissa

console.log('\n🔍 Checking Unipile Account Status for Charissa...\n');

// Get account details
const accountResponse = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts/${UNIPILE_ACCOUNT_ID}`, {
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'accept': 'application/json'
  }
});

if (!accountResponse.ok) {
  console.error(`❌ Failed to get account: ${accountResponse.status} ${accountResponse.statusText}`);
  const error = await accountResponse.text();
  console.error(error);
  process.exit(1);
}

const account = await accountResponse.json();

console.log('📊 Account Details:\n');
console.log(`   Account ID: ${account.id}`);
console.log(`   Provider: ${account.provider}`);
console.log(`   Type: ${account.type}`);
console.log(`   Status: ${account.status}`);
console.log(`   Is Connected: ${account.is_connected}`);
console.log(`   Username: ${account.username || 'N/A'}`);
console.log(`   Email: ${account.email || 'N/A'}`);
console.log(`   Last Sync: ${account.last_sync_at || 'Never'}\n`);

if (account.status !== 'RUNNING' || !account.is_connected) {
  console.log('🚨 PROBLEM FOUND!\n');
  console.log(`   Status is "${account.status}" (should be "RUNNING")`);
  console.log(`   Is Connected: ${account.is_connected} (should be true)\n`);
  console.log('This explains why LinkedIn invitations aren\'t being sent!\n');
  console.log('Solution: Reconnect Charissa\'s LinkedIn account in Unipile.\n');
} else {
  console.log('✅ Account appears to be connected properly\n');
  console.log('The issue may be with LinkedIn rate limiting or API restrictions.\n');
}

// Check for any recent errors in the account
if (account.last_error) {
  console.log('⚠️  Last Error:\n');
  console.log(`   ${account.last_error}\n`);
}
