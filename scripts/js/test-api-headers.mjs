// Test different authentication header formats
const DSN = 'api6.unipile.com:13670';
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const accountId = '4Vv6oZ73RvarImDN6iYbbg';

const authFormats = [
  { name: 'Bearer Token', headers: { 'Authorization': `Bearer ${API_KEY}` } },
  { name: 'X-Api-Key', headers: { 'X-Api-Key': API_KEY } },
  { name: 'X-API-KEY (uppercase)', headers: { 'X-API-KEY': API_KEY } },
  { name: 'api-key', headers: { 'api-key': API_KEY } },
];

console.log('🔍 Testing different authentication formats...\n');

for (const auth of authFormats) {
  console.log(`\n📋 Testing: ${auth.name}`);

  try {
    const response = await fetch(`https://${DSN}/api/v1/accounts/${accountId}`, {
      method: 'GET',
      headers: {
        ...auth.headers,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS! Account: ${data.name}`);
      console.log(`   \n🎯 CORRECT FORMAT: ${auth.name}`);
      console.log(`   Headers:`, auth.headers);
      break;
    } else {
      const error = await response.json().catch(() => ({ message: 'No JSON response' }));
      console.log(`   ❌ Failed: ${error.title || error.message}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}
