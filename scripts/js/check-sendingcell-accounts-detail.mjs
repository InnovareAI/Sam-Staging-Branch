#!/usr/bin/env node
import 'dotenv/config';

console.log('🔍 Detailed Unipile Account Check for Sendingcell\n');

const accountIds = [
  'J6pyDIoQSfmGDEIbwXBy3A',
  'Kffb2MbOR8Cy4yPfqNGMyQ'
];

for (const accountId of accountIds) {
  console.log(`\n📋 Account: ${accountId}`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts/${accountId}`, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Full Account Data:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ HTTP ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}
