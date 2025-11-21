#!/usr/bin/env node
import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

console.log('🔍 Unipile client methods:');
console.log('  Available on unipile:', Object.keys(unipile));
console.log('\n  Available on unipile.users:', Object.keys(unipile.users));
console.log('\n  Available on unipile.messaging:', Object.keys(unipile.messaging));

const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA';
const LINKEDIN_URL = 'https://www.linkedin.com/in/christian-woerle-06617b10b';
const CR_MESSAGE = "Test message";

try {
  console.log('\n📝 Getting profile...');
  
  const profile = await unipile.users.getProfile({
    account_id: ACCOUNT_ID,
    identifier: LINKEDIN_URL
  });
  
  console.log('✅ Profile:', JSON.stringify(profile, null, 2));
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  if (error.response) {
    console.error('   Status:', error.response.status);
    console.error('   Data:', JSON.stringify(error.response.data, null, 2));
  }
}
