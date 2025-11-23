#!/usr/bin/env node

const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

console.log('🔍 Testing Unipile LinkedIn Search API...\n');

const payload = {
  account_id: ACCOUNT_ID,
  type: 'CONTENT',
  keywords: '#GenAI',
  limit: 5
};

console.log('Request payload:', JSON.stringify(payload, null, 2));
console.log('\nSending request...\n');

try {
  const response = await fetch(`https://${UNIPILE_DSN}/api/v1/linkedin/search`, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log(`Status: ${response.status} ${response.statusText}\n`);

  const data = await response.json();

  if (response.ok) {
    console.log('✅ Success! Found posts:\n');
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('❌ Error response:\n');
    console.log(JSON.stringify(data, null, 2));
  }
} catch (error) {
  console.error('❌ Request failed:', error.message);
}
