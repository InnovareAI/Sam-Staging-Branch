/**
 * Test if duplicate invitation causes 422 error
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const BASE_ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

async function testDuplicateInvitation() {
  console.log('🧪 Testing duplicate invitation to lee-furnival...\n');
  console.log('⚠️  We already sent an invitation in the first test!\n');

  // Get profile
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/lee-furnival?account_id=${BASE_ACCOUNT_ID}`;
  const profileResponse = await fetch(profileUrl, {
    method: 'GET',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!profileResponse.ok) {
    console.error('❌ Failed to get profile');
    return;
  }

  const profileData = await profileResponse.json();
  console.log(`✅ Got profile: ${profileData.first_name} ${profileData.last_name}`);
  console.log(`   Provider ID: ${profileData.provider_id}\n`);

  // Try to send invitation AGAIN
  const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;
  const requestBody = {
    provider_id: profileData.provider_id,
    account_id: BASE_ACCOUNT_ID,
    message: "Testing duplicate invitation - this should fail!"
  };

  console.log('📤 Attempting to send duplicate invitation...\n');

  const response = await fetch(inviteUrl, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  console.log(`Response status: ${response.status} ${response.statusText}\n`);

  if (response.ok) {
    const result = await response.json();
    console.log('✅ SUCCESS (unexpected!)');
    console.log(JSON.stringify(result, null, 2));
  } else {
    const errorText = await response.text();
    console.log(`❌ FAILED (${response.status})`);
    console.log('Raw error:', errorText, '\n');

    try {
      const errorData = JSON.parse(errorText);
      console.log('Parsed error:');
      console.log(JSON.stringify(errorData, null, 2));
    } catch {
      console.log('(Error is not JSON)');
    }

    if (response.status === 422) {
      console.log('\n🎯 CONFIRMED: 422 ERROR FOR DUPLICATE INVITATION!');
      console.log('This is exactly what we\'re seeing in production!');
    }
  }
}

testDuplicateInvitation();
