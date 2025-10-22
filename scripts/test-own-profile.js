/**
 * Test retrieving own LinkedIn profile via Unipile
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const SOURCE_ID = 'mERQmojtSZq5GeomZZazlw_MESSAGING';

async function main() {
  console.log('🔍 Testing profile retrieval with your own profile...');

  const testProfiles = [
    'tvonlinz',  // Your profile from account data
    'williamhgates',  // Bill Gates - should be publicly accessible
    'lee-furnival'  // The failing one
  ];

  for (const profileId of testProfiles) {
    console.log(`\n📌 Testing: ${profileId}`);
    const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${profileId}?account_id=${SOURCE_ID}`;

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
        console.log(`   Public ID: ${data.public_identifier}`);
      } else {
        const error = await response.text();
        console.log(`❌ FAILED (${response.status}): ${error}`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
}

main();
