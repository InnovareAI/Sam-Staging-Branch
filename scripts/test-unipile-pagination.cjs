require('dotenv').config({ path: '.env.local' });

async function testPagination() {
  const DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
  const API_KEY = process.env.UNIPILE_API_KEY;
  const ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish LinkedIn account

  console.log('Testing Unipile pagination...');
  console.log('DSN:', DSN);
  console.log('Has API Key:', !!API_KEY);

  // Simple search with low limit to test pagination
  const url = `https://${DSN}/api/v1/linkedin/search?account_id=${ACCOUNT_ID}&limit=10`;

  const payload = {
    api: 'sales_navigator',
    category: 'people',
    keywords: 'marketing manager',
    network_distance: [2]
  };

  console.log('\n=== Request 1 (first page) ===');
  console.log('URL:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log('\nStatus:', response.status);
  const data = await response.json();

  console.log('\nItems returned:', data.items?.length || 0);
  console.log('Paging:', JSON.stringify(data.paging, null, 2));
  console.log('Has cursor:', !!data.paging?.cursor);
  if (data.paging?.cursor) {
    console.log('Cursor (first 100 chars):', data.paging.cursor.substring(0, 100));
  }

  // If cursor exists, fetch page 2
  if (data.paging?.cursor) {
    console.log('\n=== Request 2 (second page with cursor) ===');
    const cursor = encodeURIComponent(data.paging.cursor);
    const url2 = `https://${DSN}/api/v1/linkedin/search?account_id=${ACCOUNT_ID}&limit=10&cursor=${cursor}`;

    const response2 = await fetch(url2, {
      method: 'POST',
      headers: {
        'X-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Status:', response2.status);
    const data2 = await response2.json();
    console.log('Items returned:', data2.items?.length || 0);
    console.log('Paging:', JSON.stringify(data2.paging, null, 2));
    console.log('Has cursor for page 3:', !!data2.paging?.cursor);
  } else {
    console.log('\n❌ NO CURSOR RETURNED - pagination not working');
  }
}

testPagination().catch(console.error);
