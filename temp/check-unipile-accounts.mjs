#!/usr/bin/env node
import 'dotenv/config';

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

console.log('🔍 CHECKING ALL UNIPILE ACCOUNTS');
console.log('='.repeat(70));

const response = await fetch(
  `${UNIPILE_BASE_URL}/api/v1/accounts`,
  {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  }
);

if (!response.ok) {
  console.log('Failed:', response.status, await response.text());
  process.exit(1);
}

const data = await response.json();
const accounts = data.items || data;

console.log(`\nFound ${accounts.length} accounts:\n`);

for (const account of accounts) {
  console.log('─'.repeat(70));
  console.log(`Name: ${account.name || 'N/A'}`);
  console.log(`Type: ${account.type}`);
  console.log(`Status: ${account.status || account.connection_status}`);
  console.log(`ID: ${account.id}`);
  console.log(`Created: ${account.created_at}`);
  
  if (account.type === 'GOOGLE' || account.type?.includes('CALENDAR')) {
    console.log(`\n⚠️ GOOGLE/CALENDAR ACCOUNT FOUND:`);
    console.log(JSON.stringify(account, null, 2));
  }
  
  if (account.status === 'ERROR' || account.connection_status === 'error') {
    console.log(`\n❌ FAILED ACCOUNT:`);
    console.log(`   Error: ${account.error || account.error_message || 'Unknown'}`);
  }
}

console.log('\n' + '='.repeat(70));
