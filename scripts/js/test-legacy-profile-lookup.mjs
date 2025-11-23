#!/usr/bin/env node

const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

console.log('🔍 Testing Unipile Legacy Profile Lookup API...\n');
console.log('Using: GET /api/v1/users/{vanity}?account_id=...\n');

async function lookupProfileLegacy(vanity) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Looking up: ${vanity}`);
  console.log('='.repeat(70));

  // Use legacy endpoint: /api/v1/users/{vanity}?account_id=...
  const url = `https://${UNIPILE_DSN}/api/v1/users/${vanity}?account_id=${ACCOUNT_ID}`;

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
    console.log('✅ Success! Profile data:\n');
    console.log(`   Name: ${data.first_name} ${data.last_name}`);
    console.log(`   Headline: ${data.headline}`);
    console.log(`   Location: ${data.location}`);
    console.log(`   Followers: ${data.follower_count || 'N/A'}`);
    console.log(`\n   📋 provider_id: ${data.provider_id}`);

    return data.provider_id;
  } else {
    console.log('❌ Error response:\n');
    console.log(JSON.stringify(data, null, 2));
    return null;
  }
}

async function getProfilePosts(linkedInId, profileName) {
  console.log(`\n   🔄 Fetching posts for: ${profileName}...`);

  const url = `https://${UNIPILE_DSN}/api/v1/users/${linkedInId}/posts?account_id=${ACCOUNT_ID}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
    }
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`   ✅ Retrieved ${data.items?.length || 0} posts`);

    if (data.items?.length > 0) {
      console.log(`\n   First post: "${data.items[0].text?.substring(0, 100)}..."`);
      console.log(`   Posted: ${data.items[0].date || 'Unknown'}`);
    }

    return true;
  } else {
    const error = await response.json();
    console.log(`   ❌ Failed to fetch posts:`, error.title || error.type);
    return false;
  }
}

// Test profiles with full workflow
const profilesToTest = [
  { vanity: 'tvonlinz', name: 'Thorsten Linz (Our profile)' },
  { vanity: 'sama', name: 'Sam Altman' },
  { vanity: 'andrewng', name: 'Andrew Ng' },
];

let successCount = 0;

for (const profile of profilesToTest) {
  console.log(`\n\n${'*'.repeat(70)}`);
  console.log(`TEST: ${profile.name}`);
  console.log('*'.repeat(70));

  const linkedInId = await lookupProfileLegacy(profile.vanity);

  if (linkedInId) {
    const success = await getProfilePosts(linkedInId, profile.name);
    if (success) successCount++;
  }

  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.log(`\n\n${'='.repeat(70)}`);
console.log(`✅ FINAL RESULT: ${successCount}/${profilesToTest.length} profiles working end-to-end`);
console.log('='.repeat(70));

if (successCount > 0) {
  console.log('\n🎯 PROFILE-BASED MONITORING WORKFLOW:');
  console.log('1. User provides LinkedIn vanity names (tvonlinz, sama, andrewng)');
  console.log('2. GET /api/v1/users/{vanity}?account_id=... → get provider_id');
  console.log('3. GET /api/v1/users/{provider_id}/posts?account_id=... → get posts');
  console.log('4. Filter posts client-side for keywords/hashtags');
  console.log('5. Generate AI comments for matching posts');
  console.log('6. POST comments via Unipile');
  console.log('\n💡 This is the viable alternative to hashtag search!');
}
