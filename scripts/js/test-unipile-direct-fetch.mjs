#!/usr/bin/env node
/**
 * Test Unipile CR sending with direct fetch (bypassing SDK)
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA'; // Tobias Linz
const LINKEDIN_URL = 'https://www.linkedin.com/in/christian-woerle-06617b10b';
const CR_MESSAGE = "Hi Christian, your work in climate tech and digital innovation caught my attention. As someone working in B2B SaaS, I'd love to connect and explore potential synergies in the tech innovation space.";

console.log('🧪 TESTING UNIPILE CR SENDING (DIRECT FETCH)\n');
console.log(`DSN: https://${UNIPILE_DSN}`);
console.log(`API Key: ${UNIPILE_API_KEY?.substring(0, 20)}...\n`);

try {
  // Step 1: Get provider_id from LinkedIn URL
  console.log('📝 Step 1: Getting provider_id from LinkedIn URL...');
  console.log(`   URL: ${LINKEDIN_URL}`);

  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/profile?account_id=${ACCOUNT_ID}&identifier=${encodeURIComponent(LINKEDIN_URL)}`;

  const profileResponse = await fetch(profileUrl, {
    method: 'GET',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!profileResponse.ok) {
    const errorText = await profileResponse.text();
    throw new Error(`Profile fetch failed: ${profileResponse.status} ${profileResponse.statusText}\n${errorText}`);
  }

  const profile = await profileResponse.json();
  console.log(`✅ Got provider_id: ${profile.provider_id}`);
  console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
  console.log(`   Headline: ${profile.headline || 'N/A'}`);

  // Step 2: Send connection request
  console.log('\n📤 Step 2: Sending connection request...');
  console.log(`   Message: "${CR_MESSAGE.substring(0, 50)}..."`);

  const invitationUrl = `https://${UNIPILE_DSN}/api/v1/users/invitation`;

  const invitationResponse = await fetch(invitationUrl, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      account_id: ACCOUNT_ID,
      provider_id: profile.provider_id,
      message: CR_MESSAGE
    })
  });

  if (!invitationResponse.ok) {
    const errorText = await invitationResponse.text();
    throw new Error(`Invitation send failed: ${invitationResponse.status} ${invitationResponse.statusText}\n${errorText}`);
  }

  const result = await invitationResponse.json();

  console.log('\n✅ CONNECTION REQUEST SENT SUCCESSFULLY!');
  console.log(`   Result:`, JSON.stringify(result, null, 2));

} catch (error) {
  console.error('\n❌ ERROR:', error.message);
  if (error.stack) {
    console.error('   Stack:', error.stack);
  }
  process.exit(1);
}
