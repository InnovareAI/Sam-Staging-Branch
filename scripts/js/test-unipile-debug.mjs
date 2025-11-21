#!/usr/bin/env node
/**
 * Test Unipile with detailed error logging
 */

import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA';

console.log('🧪 TESTING UNIPILE CONNECTION\n');
console.log('Config:');
console.log(`  DSN: ${process.env.UNIPILE_DSN}`);
console.log(`  API Key: ${process.env.UNIPILE_API_KEY?.substring(0, 10)}...`);
console.log(`  Full URL: https://${process.env.UNIPILE_DSN}`);
console.log(`  Account ID: ${ACCOUNT_ID}`);

try {
  console.log('\n📋 Fetching LinkedIn accounts...');
  
  const accounts = await unipile.account.getLinkedInAccounts();
  
  console.log('✅ Got accounts:', JSON.stringify(accounts, null, 2));
  
} catch (error) {
  console.error('\n❌ FULL ERROR:', error);
  console.error('   Message:', error.message);
  console.error('   Code:', error.code);
  
  if (error.response) {
    console.error('\n📡 HTTP RESPONSE:');
    console.error('   Status:', error.response.status);
    console.error('   Data:', JSON.stringify(error.response.data, null, 2));
  }
  
  process.exit(1);
}
