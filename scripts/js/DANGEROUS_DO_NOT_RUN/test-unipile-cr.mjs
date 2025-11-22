#!/usr/bin/env node
/**
 * Test Unipile CR sending directly
 */

import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA'; // Tobias Linz
const LINKEDIN_URL = 'https://www.linkedin.com/in/christian-woerle-06617b10b';
const CR_MESSAGE = "Hi Christian, your work in climate tech and digital innovation caught my attention. As someone working in B2B SaaS, I'd love to connect and explore potential synergies in the tech innovation space.";

console.log('🧪 TESTING UNIPILE CR SENDING\n');

try {
  // Step 1: Get provider_id from LinkedIn URL
  console.log('📝 Step 1: Getting provider_id from LinkedIn URL...');
  console.log(`   URL: ${LINKEDIN_URL}`);

  const profile = await unipile.users.getProfile({
    account_id: ACCOUNT_ID,
    identifier: LINKEDIN_URL
  });

  console.log(`✅ Got provider_id: ${profile.provider_id}`);
  console.log(`   Name: ${profile.display_name}`);
  console.log(`   Title: ${profile.headline || 'N/A'}`);

  // Step 2: Send connection request
  console.log('\n📤 Step 2: Sending connection request...');
  console.log(`   Message: "${CR_MESSAGE.substring(0, 50)}..."`);

  const result = await unipile.users.sendInvitation({
    account_id: ACCOUNT_ID,
    provider_id: profile.provider_id,
    message: CR_MESSAGE
  });

  console.log('\n✅ CONNECTION REQUEST SENT SUCCESSFULLY!');
  console.log(`   Result:`, JSON.stringify(result, null, 2));

} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  console.error('   Code:', error.code);
  console.error('   Stack:', error.stack);
  if (error.response) {
    console.error('   HTTP Status:', error.response.status);
    console.error('   HTTP Data:', JSON.stringify(error.response.data, null, 2));
  }
  if (error.cause) {
    console.error('   Cause:', error.cause);
  }
  process.exit(1);
}
