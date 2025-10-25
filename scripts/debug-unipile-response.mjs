#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const UNIPILE_DSN = envContent.match(/UNIPILE_DSN=(.*)/)[1].trim();
const UNIPILE_API_KEY = envContent.match(/UNIPILE_API_KEY=(.*)/)[1].trim();

console.log('\n🔍 DEBUGGING UNIPILE API RESPONSE\n');

const accountUrl = `https://${UNIPILE_DSN}/api/v1/accounts`;

const response = await fetch(accountUrl, {
  headers: {
    'X-API-KEY': UNIPILE_API_KEY
  }
});

if (!response.ok) {
  console.log('❌ Failed:', response.status);
  process.exit(1);
}

const data = await response.json();

// Save full response
fs.writeFileSync(
  path.join(__dirname, 'unipile-raw-response.json'),
  JSON.stringify(data, null, 2)
);

console.log('📝 Saved full response to: scripts/unipile-raw-response.json\n');
console.log('Response structure:');
console.log(JSON.stringify(data, null, 2));
