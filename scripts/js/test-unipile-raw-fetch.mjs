#!/usr/bin/env node
/**
 * Test Unipile API with raw fetch
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const ACCOUNT_ID = 'xT9TYxlYTTC1ukKenVPhLA';
const LINKEDIN_URL = 'https://www.linkedin.com/in/christian-woerle-06617b10b';

console.log('🧪 TESTING UNIPILE WITH RAW FETCH\n');
console.log('Config:');
console.log(`  URL: https://${UNIPILE_DSN}`);
console.log(`  API Key: ${UNIPILE_API_KEY.substring(0, 10)}...`);
console.log(`  Account: ${ACCOUNT_ID}`);

// Encode LinkedIn URL for query parameter
const encodedUrl = encodeURIComponent(LINKEDIN_URL);
const url = `https://${UNIPILE_DSN}/api/v1/users/${encodedUrl}?account_id=${ACCOUNT_ID}`;

console.log(`\n📤 GET ${url}`);

try {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${UNIPILE_API_KEY}`,
      'Accept': 'application/json'
    }
  });
  
  console.log(`\n📡 Response:`);
  console.log(`   Status: ${response.status} ${response.statusText}`);
  console.log(`   Content-Type: ${response.headers.get('content-type')}`);
  
  const text = await response.text();
  
  if (response.ok) {
    console.log('\n✅ SUCCESS:');
    console.log(JSON.parse(text));
  } else {
    console.log('\n❌ ERROR RESPONSE:');
    console.log(text);
  }
  
} catch (error) {
  console.error('\n❌ FETCH ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}
