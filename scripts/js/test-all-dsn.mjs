// Test different DSN configurations
const API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const accountId = '4Vv6oZ73RvarImDN6iYbbg';

const dsns = [
  'api6.unipile.com:13670',
  'api6.unipile.com',
  'api.unipile.com',
  'api.unipile.com:13670'
];

console.log('🔍 Testing different DSN configurations...\n');

for (const dsn of dsns) {
  console.log(`\n📋 Testing DSN: ${dsn}`);

  try {
    const response = await fetch(`https://${dsn}/api/v1/accounts/${accountId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ SUCCESS! Account: ${data.name || 'Unknown'}`);
      console.log(`   \n🎯 CORRECT DSN: ${dsn}`);
      break;
    } else {
      const error = await response.json();
      console.log(`   ❌ Failed: ${error.title || error.type}`);
    }
  } catch (error) {
    console.log(`   ❌ Connection error: ${error.message}`);
  }
}
