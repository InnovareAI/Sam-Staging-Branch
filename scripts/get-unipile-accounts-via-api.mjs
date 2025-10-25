#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const UNIPILE_DSN = envContent.match(/UNIPILE_DSN=(.*)/)[1].trim();

console.log('\n📡 Fetching accounts from Unipile API...\n');

// Try the correct endpoint
const response = await fetch(`https://api7.unipile.com:13156/api/v1/accounts`, {
  headers: {
    'X-API-KEY': UNIPILE_DSN
  }
});

if (!response.ok) {
  console.log('❌ Failed:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text);
  process.exit(1);
}

const data = await response.json();
console.log(`✅ Found ${data.items?.length || 0} accounts\n`);

// Save to file for inspection
fs.writeFileSync(
  path.join(__dirname, 'unipile-accounts.json'),
  JSON.stringify(data, null, 2)
);

console.log('📝 Saved to: scripts/unipile-accounts.json\n');

// Print summary
data.items?.forEach((acc, i) => {
  console.log(`${i + 1}. ${acc.name || acc.email || 'Unnamed'} (${acc.provider})`);
  console.log(`   ID: ${acc.account_id}`);
  console.log(`   Status: ${acc.status}`);
  console.log('');
});
