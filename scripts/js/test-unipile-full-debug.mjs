#!/usr/bin/env node
import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA';
const LINKEDIN_URL = 'https://www.linkedin.com/in/christian-woerle-06617b10b';

console.log('🧪 TESTING UNIPILE WITH FULL ERROR DETAILS\n');

try {
  console.log('📝 Calling unipile.users.getProfile()...');
  console.log('   account_id:', ACCOUNT_ID);
  console.log('   identifier:', LINKEDIN_URL);
  
  const profile = await unipile.users.getProfile({
    account_id: ACCOUNT_ID,
    identifier: LINKEDIN_URL
  });
  
  console.log('\n✅ SUCCESS:', JSON.stringify(profile, null, 2));
  
} catch (error) {
  console.error('\n❌ FULL ERROR OBJECT:');
  console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  
  console.error('\n❌ ERROR PROPERTIES:');
  for (const key of Object.getOwnPropertyNames(error)) {
    console.error(`   ${key}:`, error[key]);
  }
  
  console.error('\n❌ ERROR STACK:');
  console.error(error.stack);
  
  process.exit(1);
}
