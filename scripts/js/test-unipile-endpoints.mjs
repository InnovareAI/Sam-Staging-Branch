// Test newly discovered Unipile endpoints
const DSN = 'api6.unipile.com:13670';
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const accountId = '4Vv6oZ73RvarImDN6iYbbg';
const linkedinUrl = 'https://www.linkedin.com/in/nolankushnir';

console.log('🔍 Testing Unipile Invitation Endpoints\n');

// Endpoint 1: POST /api/v1/users/add_by_identifier
console.log('📋 Test 1: POST /api/v1/users/add_by_identifier');
try {
  const response1 = await fetch(`https://${DSN}/api/v1/users/add_by_identifier`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: accountId,
      identifier: linkedinUrl,
      message: 'Hi Nolan, test connection request'
    })
  });

  console.log(`   Status: ${response1.status}`);
  const data1 = await response1.json();

  if (response1.ok) {
    console.log('   ✅ SUCCESS!');
    console.log('   Response:', data1);
  } else {
    console.log('   ❌ Failed:', data1.title || data1.message || data1.type);
  }
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log();

// Endpoint 2: POST /api/v1/linkedin/action
console.log('📋 Test 2: POST /api/v1/linkedin/action');
try {
  const response2 = await fetch(`https://${DSN}/api/v1/linkedin/action`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: accountId,
      identifier: linkedinUrl,
      action: 'invite',
      message: 'Hi Nolan, test connection request'
    })
  });

  console.log(`   Status: ${response2.status}`);
  const data2 = await response2.json();

  if (response2.ok) {
    console.log('   ✅ SUCCESS!');
    console.log('   Response:', data2);
  } else {
    console.log('   ❌ Failed:', data2.title || data2.message || data2.type);
  }
} catch (error) {
  console.log('   ❌ Error:', error.message);
}

console.log();

// Endpoint 3: POST /api/v1/attendees (generic invitation)
console.log('📋 Test 3: POST /api/v1/attendees');
try {
  const response3 = await fetch(`https://${DSN}/api/v1/attendees`, {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: accountId,
      identifier: linkedinUrl,
      message: 'Hi Nolan, test connection request'
    })
  });

  console.log(`   Status: ${response3.status}`);
  const data3 = await response3.json();

  if (response3.ok) {
    console.log('   ✅ SUCCESS!');
    console.log('   Response:', data3);
  } else {
    console.log('   ❌ Failed:', data3.title || data3.message || data3.type);
  }
} catch (error) {
  console.log('   ❌ Error:', error.message);
}
