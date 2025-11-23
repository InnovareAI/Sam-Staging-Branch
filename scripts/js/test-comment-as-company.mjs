#!/usr/bin/env node

const UNIPILE_API_KEY = '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

// Company page we want to comment as
const INNOVARE_DIGITAL = {
  name: 'Innovare Digital',
  organization_urn: 'urn:li:fsd_company:6925246',
  mailbox_urn: 'urn:li:fsd_pageMailbox:9698252'
};

console.log('🧪 Testing: Comment AS Company Page (Innovare Digital)\n');
console.log('This will test if we can leave comments as the company, not personal profile.\n');

// Step 1: Get a test post (from your own profile to test safely)
async function getTestPost() {
  console.log('Step 1: Finding a test post to comment on...\n');

  // Use your own profile for safe testing
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/tvonlinz?account_id=${ACCOUNT_ID}`;

  const profileResponse = await fetch(profileUrl, {
    method: 'GET',
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  });

  if (!profileResponse.ok) {
    console.error('❌ Failed to get profile');
    return null;
  }

  const profile = await profileResponse.json();
  console.log(`✅ Profile found: ${profile.first_name} ${profile.last_name}`);

  // Get posts
  const postsUrl = `https://${UNIPILE_DSN}/api/v1/users/${profile.provider_id}/posts?account_id=${ACCOUNT_ID}`;

  const postsResponse = await fetch(postsUrl, {
    method: 'GET',
    headers: { 'X-API-KEY': UNIPILE_API_KEY }
  });

  if (!postsResponse.ok) {
    console.error('❌ Failed to get posts');
    return null;
  }

  const posts = await postsResponse.json();

  if (posts.items?.length > 0) {
    const testPost = posts.items[0];
    console.log(`✅ Found test post: "${testPost.text?.substring(0, 60)}..."`);
    console.log(`   Social ID: ${testPost.social_id}`);
    console.log(`   URL: ${testPost.share_url}\n`);
    return testPost;
  }

  return null;
}

// Step 2: Test commenting as personal profile (baseline)
async function testPersonalComment(postSocialId) {
  console.log('Step 2: Testing comment as PERSONAL PROFILE (baseline)...\n');

  const url = `https://${UNIPILE_DSN}/api/v1/posts/${postSocialId}/comments`;

  const payload = {
    account_id: ACCOUNT_ID,
    text: '[TEST - Personal Profile] This is a test comment from Thorsten Linz (personal).'
  };

  console.log('Request:', JSON.stringify(payload, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log(`\nResponse: ${response.status} ${response.statusText}`);

  const data = await response.json();

  if (response.ok) {
    console.log('✅ SUCCESS - Personal profile comment posted!\n');
    console.log('Comment data:', JSON.stringify(data, null, 2));
    return true;
  } else {
    console.log('❌ FAILED - Personal profile comment\n');
    console.log('Error:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Step 3: Test commenting as company page
async function testCompanyComment(postSocialId) {
  console.log('\n\nStep 3: Testing comment as COMPANY PAGE (Innovare Digital)...\n');

  const url = `https://${UNIPILE_DSN}/api/v1/posts/${postSocialId}/comments`;

  // Try with organization_urn parameter
  const payload = {
    account_id: ACCOUNT_ID,
    text: '[TEST - Company Page] This is a test comment from Innovare Digital (company page).',
    organization_urn: INNOVARE_DIGITAL.organization_urn
  };

  console.log('Request:', JSON.stringify(payload, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log(`\nResponse: ${response.status} ${response.statusText}`);

  const data = await response.json();

  if (response.ok) {
    console.log('✅ SUCCESS - Company page comment posted!\n');
    console.log('Comment data:', JSON.stringify(data, null, 2));
    return true;
  } else {
    console.log('❌ FAILED - Company page comment\n');
    console.log('Error:', JSON.stringify(data, null, 2));

    // If organization_urn didn't work, suggest alternative
    console.log('\n💡 organization_urn might not be the right parameter.');
    console.log('   Try these alternatives:');
    console.log('   - organization_id');
    console.log('   - company_urn');
    console.log('   - as_organization');
    console.log('   - author_urn');

    return false;
  }
}

// Run the test
(async () => {
  try {
    const testPost = await getTestPost();

    if (!testPost) {
      console.error('❌ Could not find test post. Exiting.');
      return;
    }

    console.log('\n' + '='.repeat(70));
    console.log('TESTING COMMENTS');
    console.log('='.repeat(70) + '\n');

    // Test 1: Personal profile (should work)
    const personalSuccess = await testPersonalComment(testPost.social_id);

    // Wait before next test
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 2: Company page (testing functionality)
    const companySuccess = await testCompanyComment(testPost.social_id);

    console.log('\n\n' + '='.repeat(70));
    console.log('TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`Personal Profile Comment: ${personalSuccess ? '✅ WORKS' : '❌ FAILED'}`);
    console.log(`Company Page Comment: ${companySuccess ? '✅ WORKS' : '❌ FAILED (need to find correct parameter)'}`);
    console.log('='.repeat(70));

    if (companySuccess) {
      console.log('\n🎉 AMAZING! You can comment as company pages!');
      console.log('\nUse case: Comment as "Innovare Digital" on tech/AI posts to build brand awareness.');
      console.log('Parameter: organization_urn = "urn:li:fsd_company:6925246"');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
})();
