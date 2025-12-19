#!/usr/bin/env node

// Test WITHOUT the port number
const UNIPILE_BASE_URL = 'https://api6.unipile.com';

const unipileAccountId = 'fntPg3vJTZ2Z1MP4rISntg';
const vanity = 'tanja-peric-787b5329';

console.log('Testing Unipile API call WITHOUT port...');
console.log(`URL: ${UNIPILE_BASE_URL}/api/v1/users/${encodeURIComponent(vanity)}?account_id=${unipileAccountId}`);

if (!process.env.UNIPILE_API_KEY) {
  console.error('❌ UNIPILE_API_KEY not set');
  process.exit(1);
}

const apiKey = process.env.UNIPILE_API_KEY;

try {
  console.log('\n🔄 Making request...');
  const startTime = Date.now();
  
  const response = await fetch(`${UNIPILE_BASE_URL}/api/v1/users/${encodeURIComponent(vanity)}?account_id=${unipileAccountId}`, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  });
  
  const duration = Date.now() - startTime;
  console.log(`✅ Response received in ${duration}ms`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
  
  const body = await response.text();
  console.log(`   Body length: ${body.length} bytes`);
  
  if (response.ok) {
    const data = JSON.parse(body);
    console.log(`   ✅ SUCCESS! Provider ID: ${data.provider_id}`);
    console.log(`   Profile:`, JSON.stringify(data, null, 2).substring(0, 500));
  } else {
    console.log(`   ❌ Error response:`, body.substring(0, 300));
  }
  
} catch (error) {
  console.error('❌ Request failed:', error.message);
  console.error('   Cause:', error.cause);
}

