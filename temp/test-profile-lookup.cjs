#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function testProfileLookup() {
  const UNIPILE_DSN = process.env.UNIPILE_DSN;
  const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
  const BASE_ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';  // Your account
  const LINKEDIN_IDENTIFIER = 'michaelhaeri';  // From prospect URL

  console.log('🧪 Testing Profile Lookup (exactly as production code does):\n');
  console.log(`   Account ID: ${BASE_ACCOUNT_ID}`);
  console.log(`   LinkedIn ID: ${LINKEDIN_IDENTIFIER}\n`);

  const url = `https://${UNIPILE_DSN}/api/v1/users/${LINKEDIN_IDENTIFIER}?account_id=${BASE_ACCOUNT_ID}`;
  console.log(`   URL: ${url}\n`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`\n✅ SUCCESS! Profile found:`);
      console.log(`   Provider ID: ${data.provider_id}`);
      console.log(`   Name: ${data.name || '(not provided)'}`);
      console.log(`\n   Full response:`, JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log(`\n❌ FAILED: ${errorText}`);
    }
  } catch (error) {
    console.error(`\n❌ Exception: ${error.message}`);
  }
}

testProfileLookup().catch(console.error);
