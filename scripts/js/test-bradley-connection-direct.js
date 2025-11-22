/**
 * Direct test of Unipile API to send connection request to Bradley Breton
 * Captures EXACT error response for debugging
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';
const LINKEDIN_URL = 'http://www.linkedin.com/in/bradleybreton';

async function testBradleyConnection() {
  console.log('\n🔍 STEP 1: Get Bradley Breton\'s provider_id\n');
  console.log('Account ID:', ACCOUNT_ID);
  console.log('LinkedIn URL:', LINKEDIN_URL);
  console.log('Unipile DSN:', UNIPILE_DSN);
  console.log('');

  // Extract LinkedIn identifier from URL (bradleybreton)
  const linkedinIdentifier = LINKEDIN_URL.split('/in/')[1].replace(/\/$/, '');
  console.log('LinkedIn Identifier:', linkedinIdentifier);

  // Step 1: Get provider_id
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${ACCOUNT_ID}&provider=LINKEDIN`;
  console.log('Profile API URL:', profileUrl);

  try {
    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
      }
    });

    console.log('\n📊 Profile Response Status:', profileResponse.status);
    console.log('Response Headers:', JSON.stringify(Object.fromEntries(profileResponse.headers.entries()), null, 2));

    const profileText = await profileResponse.text();
    console.log('\n📄 Raw Profile Response:');
    console.log(profileText);

    let profileData;
    try {
      profileData = JSON.parse(profileText);
    } catch (e) {
      console.error('❌ Failed to parse profile response as JSON');
      return;
    }

    if (!profileResponse.ok) {
      console.error('\n❌ Profile request failed');
      console.error('Complete error response:', JSON.stringify(profileData, null, 2));
      return;
    }

    console.log('\n✅ Profile Data:', JSON.stringify(profileData, null, 2));

    const providerId = profileData.object?.id || profileData.id;
    if (!providerId) {
      console.error('❌ No provider_id found in response');
      return;
    }

    console.log('\n✅ Provider ID:', providerId);

    // Step 2: Send connection request
    console.log('\n🔍 STEP 2: Send connection request\n');

    const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;
    console.log('Invite API URL:', inviteUrl);

    const invitePayload = {
      account_id: ACCOUNT_ID,
      provider_id: providerId,
      message: 'Hi Bradley, I\'d like to connect!'
    };

    console.log('\n📤 Invite Payload:', JSON.stringify(invitePayload, null, 2));

    const inviteResponse = await fetch(inviteUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invitePayload)
    });

    console.log('\n📊 Invite Response Status:', inviteResponse.status);
    console.log('Response Headers:', JSON.stringify(Object.fromEntries(inviteResponse.headers.entries()), null, 2));

    const inviteText = await inviteResponse.text();
    console.log('\n📄 Raw Invite Response:');
    console.log(inviteText);

    let inviteData;
    try {
      inviteData = JSON.parse(inviteText);
    } catch (e) {
      console.error('❌ Failed to parse invite response as JSON');
      return;
    }

    console.log('\n📋 COMPLETE ERROR RESPONSE (EXACT JSON):');
    console.log(JSON.stringify(inviteData, null, 2));

    if (!inviteResponse.ok) {
      console.error('\n❌ Invite request failed');
      console.error('\nERROR BREAKDOWN:');
      console.error('- HTTP Status:', inviteResponse.status);
      console.error('- Error Title:', inviteData.title || 'N/A');
      console.error('- Error Message:', inviteData.message || 'N/A');
      console.error('- Error Type:', inviteData.type || 'N/A');
      console.error('- Error Details:', inviteData.detail || 'N/A');

      if (inviteData.errors) {
        console.error('- Validation Errors:', JSON.stringify(inviteData.errors, null, 2));
      }

      return;
    }

    console.log('\n✅ Connection request sent successfully!');
    console.log('Response:', JSON.stringify(inviteData, null, 2));

  } catch (error) {
    console.error('\n❌ EXCEPTION CAUGHT:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testBradleyConnection().catch(console.error);
