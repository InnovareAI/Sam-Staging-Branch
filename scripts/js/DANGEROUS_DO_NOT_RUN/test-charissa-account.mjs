// Test connection request with Irish's account
const DSN = 'api6.unipile.com:13670';
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const accountId = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish's account (freshly connected)
const linkedinUrl = 'https://www.linkedin.com/in/nolankushnir';

console.log('🔍 Testing with Irish account (freshly connected)\n');
console.log(`Account ID: ${accountId}\n`);

// Step 1: Get provider_id
console.log('📋 Step 1: Getting provider_id...');
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
console.log(`✅ Provider ID: ${profile.provider_id}\n`);

// Step 2: Send invitation
console.log('📋 Step 2: Sending invitation with provider_id...');
try {
  const response = await fetch(`https://${DSN}/api/v1/users/invite`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: accountId,
      provider_id: profile.provider_id,
      message: 'Hi Nolan, test from Irish account'
    })
  });

  console.log(`   Status: ${response.status}`);
  const data = await response.json();

  if (response.ok) {
    console.log('   ✅ SUCCESS!');
    console.log('   Response:', data);
  } else {
    console.log('   ❌ Failed:', data.title || data.message || data.type);
    console.log('   Full error:', JSON.stringify(data, null, 2));
  }
} catch (error) {
  console.log('   ❌ Error:', error.message);
}
