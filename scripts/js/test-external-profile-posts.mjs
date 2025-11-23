#!/usr/bin/env node

const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

console.log('🔍 Testing Unipile Posts API with External LinkedIn Profiles...\n');

// First, we need to get the LinkedIn profile ID for external profiles
// We'll use the Unipile profile lookup endpoint

async function getLinkedInProfileId(vanityName) {
  console.log(`📋 Looking up LinkedIn profile for vanity: ${vanityName}...`);

  const url = `https://${UNIPILE_DSN}/api/v1/users/profile?identifier=${vanityName}&account_id=${ACCOUNT_ID}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
    }
  });

  if (response.ok) {
    const data = await response.json();
    console.log(`✅ Found profile: ${data.display_name || data.name}`);
    console.log(`   LinkedIn ID: ${data.identifier || 'N/A'}`);
    return data.identifier;
  } else {
    const error = await response.json();
    console.log(`❌ Profile lookup failed:`, error);
    return null;
  }
}

async function getProfilePosts(linkedInId, profileName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Fetching posts for: ${profileName} (${linkedInId})`);
  console.log('='.repeat(70));

  const url = `https://${UNIPILE_DSN}/api/v1/users/${linkedInId}/posts?account_id=${ACCOUNT_ID}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
    }
  });

  console.log(`Status: ${response.status} ${response.statusText}\n`);

  if (response.ok) {
    const data = await response.json();
    console.log(`✅ SUCCESS! Retrieved ${data.items?.length || 0} posts\n`);

    if (data.items?.length > 0) {
      console.log('First 5 posts:');
      data.items.slice(0, 5).forEach((post, idx) => {
        console.log(`\n${idx + 1}. ${post.text?.substring(0, 80)}...`);
        console.log(`   Posted: ${post.date || 'Unknown'}`);
        console.log(`   Engagement: ${post.comment_counter || 0} comments, ${post.reaction_counter || 0} reactions`);
      });

      // Check if any posts contain hashtags
      const postsWithHashtags = data.items.filter(p => p.text?.includes('#'));
      console.log(`\n📊 ${postsWithHashtags.length}/${data.items.length} posts contain hashtags`);

      return true;
    }
  } else {
    const error = await response.json();
    console.log(`❌ Failed:`, error);
    return false;
  }
}

// Test with popular LinkedIn profiles
const profilesToTest = [
  { vanity: 'sama', name: 'Sam Altman (OpenAI)' },
  { vanity: 'andrewng', name: 'Andrew Ng (AI thought leader)' },
];

let successCount = 0;

for (const profile of profilesToTest) {
  console.log(`\n\n${'*'.repeat(70)}`);
  console.log(`Testing: ${profile.name}`);
  console.log('*'.repeat(70));

  const linkedInId = await getLinkedInProfileId(profile.vanity);

  if (linkedInId) {
    const success = await getProfilePosts(linkedInId, profile.name);
    if (success) successCount++;
  }

  // Wait between requests
  await new Promise(resolve => setTimeout(resolve, 2000));
}

console.log(`\n\n${'='.repeat(70)}`);
console.log(`✅ FINAL RESULT: ${successCount}/${profilesToTest.length} profiles successfully fetched`);
console.log('='.repeat(70));

if (successCount > 0) {
  console.log('\n🎯 CONCLUSION: Profile-based monitoring IS VIABLE!');
  console.log('\nHow it works:');
  console.log('1. User provides LinkedIn vanity names (sama, andrewng, etc.)');
  console.log('2. We use /api/v1/users/profile to get LinkedIn profile ID');
  console.log('3. We use /api/v1/users/{id}/posts to fetch posts');
  console.log('4. We filter posts client-side for keywords/hashtags');
  console.log('5. We generate AI comments for matching posts');
  console.log('\n💡 This solves the "no hashtag search" problem!');
}
