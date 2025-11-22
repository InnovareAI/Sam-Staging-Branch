// Test Unipile invitation endpoint to find correct path
const DSN = 'api6.unipile.com:13670';
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const accountId = '4Vv6oZ73RvarImDN6iYbbg'; // Stan's account

console.log('🔍 Testing Unipile Invitation Endpoints\n');

// Test prospect LinkedIn URL
const linkedinUrl = 'https://www.linkedin.com/in/nolankushnir';

console.log(`📋 Step 1: Get profile for ${linkedinUrl}`);

try {
  const profileResponse = await fetch(
    `https://${DSN}/api/v1/users/profile?account_id=${accountId}&identifier=${encodeURIComponent(linkedinUrl)}`,
    {
      headers: {
        'X-Api-Key': API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  if (!profileResponse.ok) {
    const error = await profileResponse.json();
    console.error('❌ Profile fetch failed:', error);
    process.exit(1);
  }

  const profile = await profileResponse.json();
  console.log('✅ Profile found:');
  console.log(`   Name: ${profile.display_name}`);
  console.log(`   Provider ID: ${profile.provider_id}`);
  console.log(`   ID: ${profile.id}\n`);

  // Now test invitation endpoints
  const testEndpoints = [
    `/api/v1/users/${profile.provider_id}/invitation`,
    `/api/v1/users/${profile.id}/invitation`,
    `/api/v1/invitations`,
    `/api/v1/users/invitation`,
  ];

  console.log('📋 Step 2: Testing invitation endpoints\n');

  for (const endpoint of testEndpoints) {
    console.log(`Testing: POST ${endpoint}`);

    try {
      const inviteResponse = await fetch(`https://${DSN}${endpoint}`, {
        method: 'POST',
        headers: {
          'X-Api-Key': API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          account_id: accountId,
          user_id: profile.provider_id,
          identifier: linkedinUrl,
          message: 'Hi Nolan, test connection request from API'
        })
      });

      console.log(`   Status: ${inviteResponse.status}`);

      const responseData = await inviteResponse.json();

      if (inviteResponse.ok) {
        console.log(`   ✅ SUCCESS! Correct endpoint: ${endpoint}`);
        console.log(`   Response:`, responseData);
        break;
      } else {
        console.log(`   ❌ Failed: ${responseData.title || responseData.message || responseData.type}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log();
  }

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
