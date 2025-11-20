#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

console.log('\n🔍 Fetching ALL Unipile accounts...\n');

const response = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts`, {
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'accept': 'application/json'
  }
});

if (!response.ok) {
  console.error(`❌ Failed: ${response.status} ${response.statusText}`);
  const error = await response.text();
  console.error(error);
  process.exit(1);
}

const data = await response.json();
const accounts = data.items || data || [];

console.log(`Found ${accounts.length} Unipile accounts:\n`);

for (const account of accounts) {
  console.log(`📧 ${account.name || 'Unnamed'}`);
  console.log(`   ID: ${account.id}`);
  console.log(`   Type: ${account.type || 'N/A'}`);
  console.log(`   Provider: ${account.provider || 'N/A'}`);
  console.log(`   Status: ${account.status || 'undefined'}`);
  console.log(`   Connected: ${account.is_connected !== undefined ? account.is_connected : 'undefined'}`);
  console.log(`   Username: ${account.username || 'N/A'}`);
  console.log(`   Email: ${account.email || 'N/A'}`);
  
  if (account.status === 'RUNNING' && account.is_connected) {
    console.log(`   ✅ WORKING\n`);
  } else {
    console.log(`   ❌ NOT CONNECTED\n`);
  }
}

// Show which accounts are working
const working = accounts.filter(a => a.status === 'RUNNING' && a.is_connected);
const broken = accounts.filter(a => a.status !== 'RUNNING' || !a.is_connected);

console.log(`\n📊 Summary:`);
console.log(`   ✅ Working: ${working.length}`);
console.log(`   ❌ Broken: ${broken.length}\n`);

if (working.length > 0) {
  console.log('✅ Working accounts:\n');
  working.forEach(a => {
    console.log(`   - ${a.name || a.email || a.username} (${a.id})`);
  });
  console.log();
}

if (broken.length > 0) {
  console.log('❌ Broken accounts (need reconnection):\n');
  broken.forEach(a => {
    console.log(`   - ${a.name || a.email || a.username || a.id} (${a.id})`);
  });
  console.log();
}
