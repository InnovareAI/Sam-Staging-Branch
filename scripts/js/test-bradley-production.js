/**
 * Test Bradley Breton connection via PRODUCTION Netlify API
 * This will use the actual production environment variables
 */

async function testBradleyProduction() {
  console.log('\n🔍 Testing Bradley Breton connection via PRODUCTION API\n');

  const PROD_URL = 'https://app.meet-sam.com';

  // We need to construct a request to the production API that will trigger
  // the Unipile connection request through the app's infrastructure

  // First, let's just test calling Unipile through the production Netlify function
  console.log('Calling production Netlify function to test Unipile...\n');

  const testPayload = {
    linkedinUrl: 'http://www.linkedin.com/in/bradleybreton',
    accountId: 'ymtTx4xVQ6OVUFk83ctwtA',
    message: 'Hi Bradley, I\'d like to connect!'
  };

  console.log('Test payload:', JSON.stringify(testPayload, null, 2));

  try {
    // Call the Netlify function that handles LinkedIn invitations
    const response = await fetch(`${PROD_URL}/api/campaigns/linkedin/test-bradley-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log('\n📊 Response Status:', response.status);
    console.log('Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    const responseText = await response.text();
    console.log('\n📄 Raw Response:');
    console.log(responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('\n📋 Parsed Response:');
      console.log(JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.error('❌ Failed to parse response as JSON');
    }

  } catch (error) {
    console.error('\n❌ EXCEPTION CAUGHT:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }

  // Alternative: Let's create a test endpoint on the Netlify function
  console.log('\n\n🔍 Alternative: Testing via debug endpoint\n');

  try {
    const debugResponse = await fetch(`${PROD_URL}/api/admin/debug-unipile-bradley`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test_bradley_invite',
        linkedinUrl: 'http://www.linkedin.com/in/bradleybreton',
        accountId: 'ymtTx4xVQ6OVUFk83ctwtA'
      })
    });

    console.log('Debug response status:', debugResponse.status);
    const debugText = await debugResponse.text();
    console.log('Debug response:', debugText);

  } catch (error) {
    console.error('Debug endpoint error:', error.message);
  }
}

testBradleyProduction().catch(console.error);
