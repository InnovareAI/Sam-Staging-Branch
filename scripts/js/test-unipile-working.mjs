#!/usr/bin/env node
/**
 * Test Unipile CR sending with correct SDK usage
 */

import { UnipileClient } from 'unipile-node-sdk';

const unipile = new UnipileClient(
  `https://${process.env.UNIPILE_DSN}`,
  process.env.UNIPILE_API_KEY
);

const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA';
const LINKEDIN_URL = 'https://www.linkedin.com/in/christian-woerle-06617b10b';
const CR_MESSAGE = "Hi Christian, your work in climate tech caught my attention. I'd love to connect!";

console.log('🧪 TESTING UNIPILE CR SENDING\n');
console.log('Config:');
console.log(`  DSN: ${process.env.UNIPILE_DSN}`);
console.log(`  Account: ${ACCOUNT_ID}`);
console.log(`  Target: ${LINKEDIN_URL}`);

try {
  // Step 1: Get provider_id
  console.log('\n📝 Step 1: Getting provider_id...');
  
  const profile = await unipile.users.getProfile({
    account_id: ACCOUNT_ID,
    identifier: LINKEDIN_URL
  });
  
  console.log(`✅ Got profile:`);
  console.log(`   Provider ID: ${profile.provider_id}`);
  console.log(`   Name: ${profile.display_name}`);
  console.log(`   Title: ${profile.headline || 'N/A'}`);
  
  // Step 2: Send invitation
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
  console.error('   Name:', error.name);
  console.error('   Code:', error.code);
  
  if (error.response) {
    console.error('\n📡 HTTP Response:');
    console.error('   Status:', error.response.status);
    console.error('   Status Text:', error.response.statusText);
    console.error('   Data:', JSON.stringify(error.response.data, null, 2));
  }
  
  if (error.cause) {
    console.error('\n   Cause:', error.cause);
  }
  
  process.exit(1);
}
