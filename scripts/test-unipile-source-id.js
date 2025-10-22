/**
 * Test script to get Unipile source ID and test profile retrieval
 */

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

async function main() {
  console.log('🔍 Fetching Unipile account details...');
  console.log(`Account ID: ${ACCOUNT_ID}`);

  try {
    // Step 1: Get account details to extract source ID
    const accountUrl = `https://${UNIPILE_DSN}/api/v1/accounts/${ACCOUNT_ID}`;
    console.log(`\nCalling: ${accountUrl}`);

    const accountResponse = await fetch(accountUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!accountResponse.ok) {
      throw new Error(`Account check failed: ${accountResponse.status} ${accountResponse.statusText}`);
    }

    const accountData = await accountResponse.json();
    console.log('\n✅ Account data received:');
    console.log(JSON.stringify(accountData, null, 2));

    // Find active source
    const activeSource = accountData.sources?.find(s => s.status === 'OK');

    if (!activeSource) {
      console.error('\n❌ No active source found!');
      console.log('Sources:', accountData.sources);
      process.exit(1);
    }

    const sourceId = activeSource.id;
    console.log(`\n✅ Active source ID: ${sourceId}`);
    console.log(`Source status: ${activeSource.status}`);

    // Step 2: Test profile retrieval
    console.log('\n🔍 Testing profile retrieval with source ID...');
    const testProfile = 'lee-furnival';
    const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${testProfile}?account_id=${sourceId}`;
    console.log(`Calling: ${profileUrl}`);

    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log(`\nProfile response status: ${profileResponse.status} ${profileResponse.statusText}`);

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log('\n✅ Profile retrieved successfully!');
      console.log('Provider ID:', profileData.provider_id);
      console.log('Public identifier:', profileData.public_identifier);
      console.log('Name:', profileData.first_name, profileData.last_name);
    } else {
      const errorText = await profileResponse.text();
      console.error('\n❌ Profile retrieval failed!');
      console.error('Error:', errorText);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
