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

console.log('\n🔍 Checking Unipile invitation history for Charissa...\n');

// Try to get invitations/messages sent from this account
const response = await fetch(`https://${UNIPILE_DSN}/api/v1/users?account_id=${UNIPILE_ACCOUNT_ID}&limit=20`, {
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'accept': 'application/json'
  }
});

if (!response.ok) {
  console.error(`❌ Failed: ${response.status} ${response.statusText}`);
  const text = await response.text();
  console.error(text);
  process.exit(1);
}

const data = await response.json();
console.log('Response:', JSON.stringify(data, null, 2));
