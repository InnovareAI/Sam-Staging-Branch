require('dotenv').config({ path: '.env.local' });

const BRIGHTDATA_CUSTOMER_ID = process.env.BRIGHT_DATA_CUSTOMER_ID;
const BRIGHTDATA_PASSWORD = process.env.BRIGHT_DATA_PASSWORD;

async function testAuth() {
  const testUrl = 'https://www.linkedin.com/in/joeldamonanderson';

  const url = 'https://api.brightdata.com/datasets/v3/trigger';

  const payload = {
    dataset_id: 'gd_l7q7dkf244hwjntr0',
    include_errors: true,
    format: 'json',
    snapshot_id: `test_${Date.now()}`,
    discover_by: 'url',
    discover: [testUrl]
  };

  const auth = Buffer.from(`${BRIGHTDATA_CUSTOMER_ID}:${BRIGHTDATA_PASSWORD}`).toString('base64');

  console.log('Testing BrightData authentication...');
  console.log(`Customer ID: ${BRIGHTDATA_CUSTOMER_ID}`);
  console.log(`Auth header: Basic ${auth.substring(0, 20)}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(payload)
  });

  console.log(`Response status: ${response.status}`);
  const responseText = await response.text();
  console.log(`Response: ${responseText}`);

  if (response.ok) {
    const data = JSON.parse(responseText);
    console.log(`\n✅ Success! Snapshot ID: ${data.snapshot_id}`);
  } else {
    console.log(`\n❌ Failed: ${responseText}`);
  }
}

testAuth().catch(console.error);
