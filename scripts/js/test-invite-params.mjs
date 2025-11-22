// Test different parameter combinations for /users/invite
const DSN = 'api6.unipile.com:13670';
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const accountId = '4Vv6oZ73RvarImDN6iYbbg'; // Stan's account
const linkedinUrl = 'https://www.linkedin.com/in/nolankushnir';

console.log('🔍 Testing /users/invite parameter combinations\n');

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
  console.error('Failed to get profile:', await profileResponse.json());
  process.exit(1);
}

const profile = await profileResponse.json();
console.log(`✅ Provider ID: ${profile.provider_id}\n`);

// Test 1: provider_id
console.log('📋 Test 1: Using provider_id');
try {
  const response1 = await fetch(`https://${DSN}/api/v1/users/invite`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: accountId,
      provider_id: profile.provider_id,
      message: 'Hi Nolan, test connection request'
    })
  });

  console.log(`   Status: ${response1.status}`);
  const data1 = await response1.json();

  if (response1.ok) {
    console.log('   ✅ SUCCESS with provider_id!');
    console.log('   Response:', data1);
  } else {
    console.log(`   ❌ Failed: ${data1.title || data1.message}`);
  }
} catch (error) {
  console.log(`   ❌ Error: ${error.message}`);
}

console.log();

// Test 2: user_id
console.log('📋 Test 2: Using user_id');
try {
  const response2 = await fetch(`https://${DSN}/api/v1/users/invite`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: accountId,
      user_id: profile.provider_id,
      message: 'Hi Nolan, test connection request'
    })
  });

  console.log(`   Status: ${response2.status}`);
  const data2 = await response2.json();

  if (response2.ok) {
    console.log('   ✅ SUCCESS with user_id!');
    console.log('   Response:', data2);
  } else {
    console.log(`   ❌ Failed: ${data2.title || data2.message}`);
  }
} catch (error) {
  console.log(`   ❌ Error: ${error.message}`);
}
