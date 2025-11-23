#!/usr/bin/env node

const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

console.log('🔍 Testing Unipile Profile Lookup API...\n');

async function lookupProfile(identifier) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Looking up: ${identifier}`);
  console.log('='.repeat(70));

  const url = `https://${UNIPILE_DSN}/api/v1/users/profile?identifier=${identifier}&account_id=${ACCOUNT_ID}`;

  console.log('Request URL:', url);
  console.log('\nSending request...\n');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
    }
  });

  console.log(`Status: ${response.status} ${response.statusText}\n`);

  const data = await response.json();

  if (response.ok) {
    console.log('✅ Success! Full response:\n');
    console.log(JSON.stringify(data, null, 2));

    // Look for ID fields
    console.log('\n📋 ID Fields Found:');
    console.log(`   identifier: ${data.identifier || 'N/A'}`);
    console.log(`   id: ${data.id || 'N/A'}`);
    console.log(`   user_id: ${data.user_id || 'N/A'}`);
    console.log(`   linkedin_id: ${data.linkedin_id || 'N/A'}`);
    console.log(`   profile_id: ${data.profile_id || 'N/A'}`);
  } else {
    console.log('❌ Error response:\n');
    console.log(JSON.stringify(data, null, 2));
  }

  return data;
}

// Test profiles
const profilesToTest = [
  'sama',           // Sam Altman
  'tvonlinz',       // Our own profile
  'andrewng',       // Andrew Ng
];

for (const identifier of profilesToTest) {
  await lookupProfile(identifier);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
