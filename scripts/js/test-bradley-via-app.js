/**
 * Test sending connection request to Bradley Breton via app API
 * This uses the application's own Unipile integration
 */

async function testBradley() {
  const APP_URL = 'http://localhost:3001'; // Or use production: https://app.meet-sam.com

  console.log('\n🔍 Testing Bradley Breton connection request via app API\n');

  // Step 1: Get a valid session token
  // For this test, we'll call the API endpoint directly
  // In production, you'd need proper authentication

  const testPayload = {
    accountId: 'ymtTx4xVQ6OVUFk83ctwtA',
    providerId: 'ACoAAELCzugBwqLlcMhNJkwBZZuMV0HzfHGabJo', // Bradley's provider_id (we'll need to get this)
    linkedinUrl: 'http://www.linkedin.com/in/bradleybreton',
    message: 'Hi Bradley, I\'d like to connect!'
  };

  console.log('Test payload:', JSON.stringify(testPayload, null, 2));

  // For now, let's test the direct Unipile call with proper error handling
  const UNIPILE_DSN = process.env.UNIPILE_DSN;
  const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

  console.log('\n🔍 STEP 1: Get all Unipile accounts to verify API key\n');

  try {
    const accountsResponse = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts`, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
      }
    });

    console.log('Accounts response status:', accountsResponse.status);

    const accountsText = await accountsResponse.text();
    console.log('Accounts response:', accountsText);

    if (!accountsResponse.ok) {
      console.error('\n❌ Failed to authenticate with Unipile');
      console.error('This API key may not be valid or the DSN may be wrong');
      return;
    }

    const accounts = JSON.parse(accountsText);
    console.log('\n✅ Successfully authenticated!');
    console.log('Available accounts:', JSON.stringify(accounts, null, 2));

    // Find the LinkedIn account
    const linkedinAccount = accounts.items?.find(acc =>
      acc.id === 'ymtTx4xVQ6OVUFk83ctwtA' || acc.id.startsWith('ymtTx4xVQ6OVUFk83ctwtA')
    );

    if (!linkedinAccount) {
      console.error('\n❌ Could not find LinkedIn account with ID:', 'ymtTx4xVQ6OVUFk83ctwtA');
      console.error('Available account IDs:', accounts.items?.map(a => a.id));
      return;
    }

    console.log('\n✅ Found LinkedIn account:', linkedinAccount);

    // Step 2: Get Bradley's profile
    console.log('\n🔍 STEP 2: Get Bradley Breton\'s profile\n');

    const linkedinIdentifier = 'bradleybreton';
    const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${linkedinAccount.id}&provider=LINKEDIN`;

    console.log('Profile URL:', profileUrl);

    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json',
      }
    });

    console.log('Profile response status:', profileResponse.status);

    const profileText = await profileResponse.text();
    console.log('Profile response:', profileText);

    if (!profileResponse.ok) {
      console.error('\n❌ Failed to get Bradley\'s profile');
      return;
    }

    const profile = JSON.parse(profileText);
    console.log('\n✅ Bradley\'s profile:', JSON.stringify(profile, null, 2));

    const providerId = profile.object?.id || profile.id;
    if (!providerId) {
      console.error('❌ No provider_id in profile');
      return;
    }

    console.log('\n✅ Bradley\'s provider_id:', providerId);

    // Step 3: Send connection request
    console.log('\n🔍 STEP 3: Send connection request\n');

    const invitePayload = {
      account_id: linkedinAccount.id,
      provider_id: providerId,
      message: 'Hi Bradley, I\'d like to connect!'
    };

    console.log('Invite payload:', JSON.stringify(invitePayload, null, 2));

    const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;
    console.log('Invite URL:', inviteUrl);

    const inviteResponse = await fetch(inviteUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(invitePayload)
    });

    console.log('\n📊 INVITE RESPONSE STATUS:', inviteResponse.status);
    console.log('Response headers:', JSON.stringify(Object.fromEntries(inviteResponse.headers.entries()), null, 2));

    const inviteText = await inviteResponse.text();
    console.log('\n📄 RAW INVITE RESPONSE:');
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
      console.error('\n❌ CONNECTION REQUEST FAILED');
      console.error('\n🔴 ERROR BREAKDOWN:');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('HTTP Status:', inviteResponse.status);
      console.error('Error Type:', inviteData.type || 'N/A');
      console.error('Error Title:', inviteData.title || 'N/A');
      console.error('Error Message:', inviteData.message || 'N/A');
      console.error('Error Detail:', inviteData.detail || 'N/A');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      if (inviteData.errors) {
        console.error('\nValidation Errors:', JSON.stringify(inviteData.errors, null, 2));
      }

      return;
    }

    console.log('\n✅ CONNECTION REQUEST SENT SUCCESSFULLY!');
    console.log('Response:', JSON.stringify(inviteData, null, 2));

  } catch (error) {
    console.error('\n❌ EXCEPTION CAUGHT:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
}

testBradley().catch(console.error);
