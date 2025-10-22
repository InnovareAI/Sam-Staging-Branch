/**
 * Test LinkedIn invitation sending to diagnose 422 error
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const BASE_ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';  // Base account ID

async function testInvitation() {
  console.log('🔍 Testing LinkedIn Invitation Flow...\n');

  // STEP 1: Get profile to extract provider_id
  const testProfile = 'lee-furnival';  // The failing profile from the campaign
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${testProfile}?account_id=${BASE_ACCOUNT_ID}`;

  console.log('📌 Step 1: Retrieving profile...');
  console.log(`   Profile: ${testProfile}`);
  console.log(`   URL: ${profileUrl}`);

  try {
    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      console.log(`❌ Profile retrieval failed (${profileResponse.status}): ${error}`);
      return;
    }

    const profileData = await profileResponse.json();
    console.log(`✅ Profile retrieved successfully!`);
    console.log(`   Name: ${profileData.first_name} ${profileData.last_name}`);
    console.log(`   Provider ID: ${profileData.provider_id}`);
    console.log(`   Public ID: ${profileData.public_identifier}`);

    // STEP 2: Send invitation
    console.log('\n📌 Step 2: Sending invitation...');
    const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;

    const requestBody = {
      provider_id: profileData.provider_id,
      account_id: BASE_ACCOUNT_ID,
      message: "Hi Lee, I noticed we share similar interests in AI and business development. I'd love to connect and exchange ideas!"
    };

    console.log('   Request body:', JSON.stringify(requestBody, null, 2));

    const inviteResponse = await fetch(inviteUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`\n   Response status: ${inviteResponse.status} ${inviteResponse.statusText}`);

    if (inviteResponse.ok) {
      const result = await inviteResponse.json();
      console.log('✅ Invitation sent successfully!');
      console.log('   Response:', JSON.stringify(result, null, 2));
    } else {
      const errorText = await inviteResponse.text();
      console.log(`\n❌ Invitation failed (${inviteResponse.status})`);
      console.log('   Raw error response:', errorText);

      try {
        const errorData = JSON.parse(errorText);
        console.log('   Parsed error:', JSON.stringify(errorData, null, 2));
      } catch {
        console.log('   (Error is not JSON)');
      }

      // Try different variations to diagnose the issue
      console.log('\n🔬 Diagnostic Tests:');

      // Test 1: Without message
      console.log('\n   Test 1: Sending without message...');
      const testBody1 = {
        provider_id: profileData.provider_id,
        account_id: BASE_ACCOUNT_ID
      };
      const test1 = await fetch(inviteUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testBody1)
      });
      console.log(`   Result: ${test1.status} ${test1.statusText}`);
      if (!test1.ok) {
        const err = await test1.text();
        console.log(`   Error: ${err.substring(0, 200)}`);
      }

      // Test 2: With shorter message
      console.log('\n   Test 2: Sending with shorter message...');
      const testBody2 = {
        provider_id: profileData.provider_id,
        account_id: BASE_ACCOUNT_ID,
        message: 'Hi Lee, would love to connect!'
      };
      const test2 = await fetch(inviteUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testBody2)
      });
      console.log(`   Result: ${test2.status} ${test2.statusText}`);
      if (!test2.ok) {
        const err = await test2.text();
        console.log(`   Error: ${err.substring(0, 200)}`);
      }
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testInvitation();
