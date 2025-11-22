import { UnipileClient } from 'unipile-node-sdk';

const DSN = 'api6.unipile.com:13670';
const API_KEY = '/kdLciOD.5b8LbZkgBTK60Dubiv8ER49imjSwJV1cBCyZotKj70I=';

console.log('🔍 Testing new Unipile API key...\n');
console.log('DSN:', DSN);
console.log('API Key:', API_KEY.substring(0, 15) + '...\n');

const unipile = new UnipileClient(
  `https://${DSN}`,
  API_KEY
);

try {
  console.log('📋 Fetching accounts...');
  const accounts = await unipile.accounts.list();

  console.log(`\n✅ Success! Found ${accounts.items.length} accounts:`);
  accounts.items.forEach(acc => {
    console.log(`  - ${acc.name} (${acc.provider}) - ${acc.id}`);
  });
} catch (error) {
  console.error('\n❌ Error:', {
    message: error.message,
    status: error.status,
    type: error.type,
    title: error.title
  });
}
