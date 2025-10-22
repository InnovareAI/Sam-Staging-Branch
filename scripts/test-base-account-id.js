/**
 * Test with base account ID vs source ID
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const BASE_ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';  // Base account ID
const SOURCE_ID = 'mERQmojtSZq5GeomZZazlw_MESSAGING';  // Source ID with suffix

async function testProfile(profileId, accountId, label) {
  console.log(`\n📌 Testing ${label}: ${profileId}`);
  console.log(`   Account ID: ${accountId}`);

  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${profileId}?account_id=${accountId}`;

  try {
    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ SUCCESS: ${data.first_name} ${data.last_name}`);
      console.log(`   Provider ID: ${data.provider_id}`);
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ FAILED (${response.status}): ${error.substring(0, 100)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Comparing BASE ACCOUNT ID vs SOURCE ID...\n');
  console.log(`Base Account ID: ${BASE_ACCOUNT_ID}`);
  console.log(`Source ID: ${SOURCE_ID}`);

  const profileToTest = 'williamhgates';  // Public profile

  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Using SOURCE ID (with _MESSAGING suffix)');
  console.log('='.repeat(60));
  await testProfile(profileToTest, SOURCE_ID, 'Source ID');

  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Using BASE ACCOUNT ID (no suffix)');
  console.log('='.repeat(60));
  const success = await testProfile(profileToTest, BASE_ACCOUNT_ID, 'Base Account ID');

  if (success) {
    console.log('\n✅ BASE ACCOUNT ID WORKS!');
    console.log('🔧 We need to use the base account ID, not the source ID for profile retrieval!');
  }
}

main();
