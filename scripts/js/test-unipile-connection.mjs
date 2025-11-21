#!/usr/bin/env node
/**
 * Test basic Unipile connection
 */

import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

console.log('🧪 TESTING UNIPILE CONNECTION\n');
console.log(`DSN: https://${process.env.UNIPILE_DSN}`);
console.log(`API Key: ${process.env.UNIPILE_API_KEY.substring(0, 20)}...\n`);

try {
  console.log('📋 Fetching accounts list...');
  const accounts = await unipile.account.getHostedAccounts();

  console.log(`\n✅ Connection successful! Found ${accounts.items.length} accounts:`);
  accounts.items.forEach((acc, i) => {
    console.log(`\n${i + 1}. ${acc.name || acc.type}`);
    console.log(`   ID: ${acc.id}`);
    console.log(`   Type: ${acc.type}`);
    console.log(`   Status: ${acc.status || 'N/A'}`);
  });

} catch (error) {
  console.error('\n❌ CONNECTION FAILED');
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  }
  console.error('Full error:', JSON.stringify(error, null, 2));
  process.exit(1);
}
