#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function testWithBaseId() {
  console.log('🧪 Testing invitation API with BASE account ID...\n');

  const linkedinIdentifier = 'riqueford';
  const baseAccountId = 'mERQmojtSZq5GeomZZazlw';

  // Step 1: Get profile
  const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${baseAccountId}`;
  const profileResponse = await fetch(profileUrl, {
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  const profileData = await profileResponse.json();
  console.log(`✅ Profile provider_id: ${profileData.provider_id}\n`);

  // Step 2: Send invitation with BASE ID (not source ID)
  const inviteEndpoint = `https://${process.env.UNIPILE_DSN}/api/v1/users/invite`;
  const requestBody = {
    provider_id: profileData.provider_id,
    account_id: baseAccountId,  // Using BASE ID
    message: 'Test message from SAM AI'
  };

  console.log('Testing with BASE account ID:', baseAccountId);
  console.log('Request:', JSON.stringify(requestBody, null, 2), '\n');

  const inviteResponse = await fetch(inviteEndpoint, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  console.log(`Response: ${inviteResponse.status} ${inviteResponse.statusText}`);
  const responseText = await inviteResponse.text();
  console.log('Body:', responseText, '\n');

  if (inviteResponse.ok) {
    console.log('✅ SUCCESS! Base account ID works for invitations!');
  } else {
    console.log('❌ Still fails with base ID');
  }
}

testWithBaseId().catch(console.error);
