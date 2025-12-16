#!/usr/bin/env node

// Use the working API key from earlier
const UNIPILE_BASE_URL = 'https://api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

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
  
  if (account.type === 'GOOGLE' || account.type?.toLowerCase().includes('calendar') || account.type?.toLowerCase().includes('google')) {
    console.log(`\n⚠️ GOOGLE/CALENDAR ACCOUNT:`);
    console.log(JSON.stringify(account, null, 2));
  }
  
  if (account.status === 'ERROR' || account.connection_status === 'error' || account.status === 'CREDENTIALS_ERROR') {
    console.log(`\n❌ FAILED ACCOUNT:`);
    console.log(JSON.stringify(account, null, 2));
  }
}

console.log('\n' + '='.repeat(70));
