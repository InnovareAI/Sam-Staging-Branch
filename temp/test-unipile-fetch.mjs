#!/usr/bin/env node

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

// Test data from failed item
const unipileAccountId = 'fntPg3vJTZ2Z1MP4rISntg';
const vanity = 'tanja-peric-787b5329';

console.log('Testing Unipile API call...');
console.log(`URL: ${UNIPILE_BASE_URL}/api/v1/users/${encodeURIComponent(vanity)}?account_id=${unipileAccountId}`);
console.log('');

// Check if UNIPILE_API_KEY is set
if (!process.env.UNIPILE_API_KEY) {
  console.error('❌ UNIPILE_API_KEY not set in environment');
  process.exit(1);
}

const apiKey = process.env.UNIPILE_API_KEY;
console.log(`API Key: ${apiKey.substring(0, 10)}...`);

try {
  console.log('\n🔄 Making request to Unipile...');
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
  console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
  
  const body = await response.text();
  console.log(`   Body length: ${body.length} bytes`);
  
  if (response.ok) {
    const data = JSON.parse(body);
    console.log(`   Provider ID: ${data.provider_id}`);
    console.log(`   Full response:`, JSON.stringify(data, null, 2));
  } else {
    console.log(`   Error body:`, body);
  }
  
} catch (error) {
  console.error('❌ Request failed:', error);
  console.error('   Error type:', error.constructor.name);
  console.error('   Error message:', error.message);
  console.error('   Error cause:', error.cause);
  console.error('   Full error:', JSON.stringify(error, null, 2));
}

