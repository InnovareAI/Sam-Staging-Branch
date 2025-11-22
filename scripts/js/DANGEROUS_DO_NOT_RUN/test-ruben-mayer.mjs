// Test connection request to Ruben Mayer to diagnose the error
const DSN = 'api6.unipile.com:13670';
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const accountId = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish's account
const linkedinUrl = 'https://www.linkedin.com/in/rubenmayer?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAABeQoWMBkLV9L4lY6dFY-wYg1E_9Upnj2II';

console.log('🔍 Testing Ruben Mayer connection request\n');

// Step 1: Get provider_id
console.log('📋 Step 1: Getting provider_id...');
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

  console.log(`   Status: ${profileResponse.status}`);

  if (!profileResponse.ok) {
    const error = await profileResponse.json();
    console.error('   ❌ Profile fetch failed:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  const profile = await profileResponse.json();
  console.log(`   ✅ Provider ID: ${profile.provider_id}`);
  console.log(`   Name: ${profile.display_name}\n`);

  // Step 2: Send invitation
  console.log('📋 Step 2: Sending invitation...');
  const inviteResponse = await fetch(`https://${DSN}/api/v1/users/invite`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: accountId,
      provider_id: profile.provider_id,
      message: 'Hi Ruben, test connection request'
    })
  });

  console.log(`   Status: ${inviteResponse.status}`);
  const data = await inviteResponse.json();

  if (inviteResponse.ok) {
    console.log('   ✅ SUCCESS!');
    console.log('   Response:', JSON.stringify(data, null, 2));
  } else {
    console.log('   ❌ Failed:', data.title || data.message || data.type);
    console.log('   Full error:', JSON.stringify(data, null, 2));
  }

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
