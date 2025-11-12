#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

console.log('🔍 Checking Unipile Account\n');
console.log('Unipile DSN:', UNIPILE_DSN);
console.log('');

// The account ID we're trying to use
const accountId = 'MT39bAEDTJ6e_ZPY337UgQ';

console.log(`Checking account: ${accountId}\n`);

// Try to get the specific account
const accountResponse = await fetch(`${UNIPILE_DSN}/api/v1/accounts/${accountId}`, {
  headers: { 'X-API-KEY': UNIPILE_API_KEY }
});

console.log(`Account lookup: ${accountResponse.status} ${accountResponse.statusText}`);

if (accountResponse.ok) {
  const account = await accountResponse.json();
  console.log('✅ Account exists!');
  console.log('   Provider:', account.provider);
  console.log('   Name:', account.name);
  console.log('   Active:', account.is_active);
} else {
  const error = await accountResponse.text();
  console.log('❌ Account not found');
  console.log('   Error:', error);
  console.log('');
  
  // List all accounts
  console.log('Fetching all Unipile accounts...\n');
  
  const allResponse = await fetch(`${UNIPILE_DSN}/api/v1/accounts`, {
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  });
  
  if (allResponse.ok) {
    const accounts = await allResponse.json();
    console.log(`Found ${accounts.items?.length || 0} accounts:\n`);
    accounts.items?.forEach((acc, i) => {
      console.log(`${i + 1}. ID: ${acc.id}`);
      console.log(`   Name: ${acc.name}`);
      console.log(`   Provider: ${acc.provider}`);
      console.log(`   Active: ${acc.is_active}`);
      console.log('');
    });
  }
}
