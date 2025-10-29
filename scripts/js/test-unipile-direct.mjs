#!/usr/bin/env node
import 'dotenv/config';

console.log('🧪 TESTING UNIPILE API DIRECTLY\n');

// Test with one real prospect
const linkedinUsername = 'ignaciodeleon';
const accountId = 'mERQmojtSZq5GeomZZazlw';

console.log(`LinkedIn Username: ${linkedinUsername}`);
console.log(`Account ID: ${accountId}\n`);

// Step 1: Get profile to get provider_id
console.log('Step 1: Fetching LinkedIn profile...');
const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${accountId}`;

const profileResponse = await fetch(profileUrl, {
  method: 'GET',
  headers: {
    'X-API-KEY': process.env.UNIPILE_API_KEY,
    'Accept': 'application/json'
  }
});

console.log(`Profile Response Status: ${profileResponse.status}\n`);

if (!profileResponse.ok) {
  const errorText = await profileResponse.text();
  console.error('❌ PROFILE FETCH FAILED:');
  console.error(errorText);
  process.exit(1);
}

const profileData = await profileResponse.json();
console.log('✅ Profile fetched successfully');
console.log(`Provider ID: ${profileData.provider_id}\n`);

// Step 2: Send invitation
console.log('Step 2: Sending invitation...');
const inviteUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/invite`;

const requestBody = {
  provider_id: profileData.provider_id,
  account_id: accountId,
  message: 'Test connection request from API'
};

console.log('Request Body:', JSON.stringify(requestBody, null, 2));

const inviteResponse = await fetch(inviteUrl, {
  method: 'POST',
  headers: {
    'X-API-KEY': process.env.UNIPILE_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify(requestBody)
});

console.log(`\nInvite Response Status: ${inviteResponse.status}`);

const responseText = await inviteResponse.text();
console.log('\nResponse Body:');
console.log(responseText);

if (!inviteResponse.ok) {
  console.error('\n❌ INVITATION FAILED - THIS IS THE REAL ERROR');
} else {
  console.log('\n✅ INVITATION SENT SUCCESSFULLY');
}
