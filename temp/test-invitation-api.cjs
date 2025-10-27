#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function testInvitationAPI() {
  console.log('🧪 Testing Unipile Invitation API directly...\n');

  // Step 1: Get profile to get provider_id
  const linkedinIdentifier = 'riqueford';
  const baseAccountId = 'mERQmojtSZq5GeomZZazlw';
  const sourceAccountId = 'mERQmojtSZq5GeomZZazlw_MESSAGING';

  console.log('Step 1: Fetching profile...');
  const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinIdentifier}?account_id=${baseAccountId}`;

  const profileResponse = await fetch(profileUrl, {
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!profileResponse.ok) {
    console.error('❌ Profile lookup failed:', await profileResponse.text());
    return;
  }

  const profileData = await profileResponse.json();
  console.log('✅ Profile data:', JSON.stringify(profileData, null, 2));
  console.log(`   provider_id: ${profileData.provider_id}`);
  console.log('');

  // Step 2: Send invitation
  console.log('Step 2: Sending invitation...');
  const inviteEndpoint = `https://${process.env.UNIPILE_DSN}/api/v1/users/invite`;

  const requestBody = {
    provider_id: profileData.provider_id,
    account_id: sourceAccountId,
    message: 'Test message from SAM AI'
  };

  console.log('   Endpoint:', inviteEndpoint);
  console.log('   Request body:', JSON.stringify(requestBody, null, 2));
  console.log('');

  const inviteResponse = await fetch(inviteEndpoint, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  console.log(`Response status: ${inviteResponse.status} ${inviteResponse.statusText}`);

  const responseText = await inviteResponse.text();
  console.log('Response body:', responseText);

  if (inviteResponse.ok) {
    console.log('✅ SUCCESS!');
  } else {
    console.log('❌ FAILED');
    try {
      const errorData = JSON.parse(responseText);
      console.log('Error details:', JSON.stringify(errorData, null, 2));
    } catch (e) {
      console.log('Could not parse error as JSON');
    }
  }
}

testInvitationAPI().catch(console.error);
