#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function testRiqueford() {
  const url = 'https://api6.unipile.com:13670/api/v1/users/riqueford?account_id=mERQmojtSZq5GeomZZazlw';

  console.log(`🧪 Testing profile lookup for riqueford`);
  console.log(`   URL: ${url}\n`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  console.log(`Status: ${response.status} ${response.statusText}`);

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log(`\n✅ SUCCESS: Found ${data.first_name} ${data.last_name}`);
  } else {
    console.log(`\n❌ FAILED: ${data.error || data.message || 'Unknown error'}`);
  }
}

testRiqueford().catch(console.error);
