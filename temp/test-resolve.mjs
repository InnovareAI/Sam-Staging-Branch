// Test resolution of a vanity to provider_id via Unipile

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = 'XPZ7hK0rMm.0vrSxnldwYPLSDFGwmjxfgTCOMjHNkWsYI84rlRU6fqE=';

// Pick an account to use for lookup
const ACCOUNT_ID = 'rV0czB_nTLC8KSRb69_zRg'; // Jennifer's account

async function unipileRequest(endpoint) {
  const response = await fetch(`https://${UNIPILE_DSN}${endpoint}`, {
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(JSON.stringify(error));
  }

  return response.json();
}

async function testResolve(vanityOrUrl) {
  console.log('\n=== Testing:', vanityOrUrl, '===');

  // Extract vanity from URL if needed
  let vanity = vanityOrUrl;
  if (vanityOrUrl.includes('linkedin.com')) {
    const match = vanityOrUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (match) {
      vanity = match[1];
    }
  }

  console.log('Extracted vanity:', vanity);

  try {
    const profile = await unipileRequest(`/api/v1/users/${encodeURIComponent(vanity)}?account_id=${ACCOUNT_ID}`);
    console.log('Profile result:');
    console.log('  provider_id:', profile.provider_id);
    console.log('  public_identifier:', profile.public_identifier);
    console.log('  first_name:', profile.first_name);
    console.log('  last_name:', profile.last_name);
    return profile.provider_id;
  } catch (err) {
    console.log('Error:', err.message);
    return null;
  }
}

// Test with some failed items
async function main() {
  await testResolve('http://www.linkedin.com/in/harryiyer');
  await testResolve('andrewkalmon');
  await testResolve('dan-tucker-925a597');
}

main().catch(console.error);
