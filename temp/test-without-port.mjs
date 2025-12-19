#!/usr/bin/env node

// Test both with and without port
const tests = [
  { name: 'With port :13670', url: 'https://api6.unipile.com:13670' },
  { name: 'Without port (default 443)', url: 'https://api6.unipile.com' },
];

const API_KEY = process.env.UNIPILE_API_KEY;
const accountId = 'fntPg3vJTZ2Z1MP4rISntg';
const vanity = 'tanja-peric-787b5329';

for (const test of tests) {
  console.log(`\n${test.name}:`);
  console.log(`   URL: ${test.url}/api/v1/users/${vanity}?account_id=${accountId}`);
  
  try {
    const response = await fetch(`${test.url}/api/v1/users/${vanity}?account_id=${accountId}`, {
      headers: {
        'X-API-KEY': API_KEY,
        'Accept': 'application/json',
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS! Provider ID: ${data.provider_id}`);
    } else {
      const body = await response.text();
      console.log(`   ❌ Error: ${body.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`   ❌ Fetch failed: ${error.message}`);
    if (error.cause) {
      console.log(`   Cause: ${error.cause.code || error.cause.message}`);
    }
  }
}

