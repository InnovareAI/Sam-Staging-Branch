#!/usr/bin/env node

// Try the standard HTTPS endpoint (no custom port)
const UNIPILE_BASE_URL = 'https://api6.unipile.com';

const unipileAccountId = 'fntPg3vJTZ2Z1MP4rISntg';

console.log('Testing Unipile API health check...');
console.log(`URL: ${UNIPILE_BASE_URL}/healthcheck`);

if (!process.env.UNIPILE_API_KEY) {
  console.error('❌ UNIPILE_API_KEY not set');
  process.exit(1);
}

const apiKey = process.env.UNIPILE_API_KEY;

try {
  // First, test a simple health check or account list
  console.log('\n🔄 Testing /api/v1/accounts endpoint...');
  const response = await fetch(`${UNIPILE_BASE_URL}/api/v1/accounts`, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      'Accept': 'application/json',
    }
  });
  
  console.log(`   Status: ${response.status} ${response.statusText}`);
  
  const body = await response.text();
  console.log(`   Body length: ${body.length} bytes`);
  
  if (response.ok) {
    const data = JSON.parse(body);
    console.log(`   ✅ SUCCESS! Accounts:`, JSON.stringify(data, null, 2).substring(0, 1000));
  } else {
    console.log(`   Response:`, body.substring(0, 500));
  }
  
} catch (error) {
  console.error('❌ Request failed:', error.message);
  if (error.cause) {
    console.error('   Cause:', error.cause.message || error.cause);
  }
}

