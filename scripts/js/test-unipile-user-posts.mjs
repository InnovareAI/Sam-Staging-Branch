#!/usr/bin/env node

const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

// Test with different identifier formats
// Format 1: LinkedIn vanity name (publicIdentifier from account API)
// Format 2: LinkedIn profile ID (ACoAAACYv0MB5sgfg5P09EbKyGzp2OH-qwKEmgc)
// Format 3: Unipile provider_id (ymtTx4xVQ6OVUFk83ctwtA)

const IDENTIFIERS_TO_TEST = [
  { name: 'LinkedIn publicIdentifier', value: 'tvonlinz' },
  { name: 'LinkedIn profile ID', value: 'ACoAAACYv0MB5sgfg5P09EbKyGzp2OH-qwKEmgc' },
  { name: 'Unipile provider_id', value: 'ymtTx4xVQ6OVUFk83ctwtA' },
];

console.log('🔍 Testing Unipile User Posts API with multiple identifier formats...\n');

for (const identifier of IDENTIFIERS_TO_TEST) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing with ${identifier.name}: ${identifier.value}`);
  console.log('='.repeat(70));

  try {
    const url = `https://${UNIPILE_DSN}/api/v1/users/${identifier.value}/posts?account_id=${ACCOUNT_ID}`;

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
      console.log(`✅ SUCCESS with ${identifier.name}!\n`);
      console.log(`Total posts: ${data.items?.length || 0}\n`);

      if (data.items?.length > 0) {
        console.log('First 3 posts:');
        data.items.slice(0, 3).forEach((post, idx) => {
          console.log(`\n${idx + 1}. Post ID: ${post.id || post.social_id}`);
          console.log(`   Text: ${post.text?.substring(0, 100)}...`);
          console.log(`   URL: ${post.url || post.share_url}`);
          console.log(`   Date: ${post.date || post.created_at}`);
        });

        console.log('\n\n🎯 WORKING IDENTIFIER FORMAT:', identifier.name);
        console.log('Use this format for profile-based monitoring!\n');
        break; // Stop on first success
      }
    } else {
      console.log(`❌ Failed with ${identifier.name}:`);
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(`❌ Request failed with ${identifier.name}:`, error.message);
  }
}

console.log('\n\nTest complete. Check above for working identifier format.');
