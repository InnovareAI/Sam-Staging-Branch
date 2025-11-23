#!/usr/bin/env node

const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

console.log('🔍 Testing Unipile List Accounts API...\n');
console.log('Getting connected LinkedIn accounts...\n');

try {
  const url = `https://${UNIPILE_DSN}/api/v1/accounts/${ACCOUNT_ID}`;

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
    console.log('✅ Success! Account details:\n');
    console.log(JSON.stringify(data, null, 2));

    // Extract useful identifiers for LinkedIn profile
    if (data.provider === 'LINKEDIN') {
      console.log('\n📋 LinkedIn Identifiers Found:');
      console.log(`   Provider ID: ${data.provider_id || 'N/A'}`);
      console.log(`   Username: ${data.username || 'N/A'}`);
      console.log(`   Display Name: ${data.display_name || 'N/A'}`);

      // Check if there's a profile URL or vanity name
      if (data.user_identifier) {
        console.log(`   User Identifier: ${data.user_identifier}`);
      }

      console.log('\n💡 Try using these identifiers with /api/v1/users/{identifier}/posts');
    }
  } else {
    console.log('❌ Error response:\n');
    console.log(JSON.stringify(data, null, 2));
  }
} catch (error) {
  console.error('❌ Request failed:', error.message);
}
