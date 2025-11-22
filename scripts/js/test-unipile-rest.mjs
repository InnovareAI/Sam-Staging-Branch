// Test Unipile API directly with fetch
const DSN = 'api6.unipile.com:13670';
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';

console.log('🔍 Testing Unipile REST API...\n');
console.log('DSN:', DSN);
console.log('API Key:', API_KEY.substring(0, 15) + '...\n');

const accountId = '4Vv6oZ73RvarImDN6iYbbg'; // Stan's account

try {
  console.log(`📋 Fetching account ${accountId}...`);

  const response = await fetch(`https://${DSN}/api/v1/accounts/${accountId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  console.log('Response status:', response.status);

  const data = await response.json();
  console.log('\nResponse data:', JSON.stringify(data, null, 2));

  if (response.ok) {
    console.log('\n✅ Success! Account found:', data.name);
  } else {
    console.log('\n❌ Error:', data.status, data.type, data.title);
  }
} catch (error) {
  console.error('\n❌ Fetch error:', error.message);
}
