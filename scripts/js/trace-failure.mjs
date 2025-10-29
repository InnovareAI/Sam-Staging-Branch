#!/usr/bin/env node
import 'dotenv/config';

// Test ONE specific prospect to see the exact error
const campaignId = '8ba7f767-42a9-4c44-808a-b244e9afdd32'; // Your campaign with 8 pending

console.log('🔍 Tracing Exact Failure...\n');

const response = await fetch('https://app.meet-sam.com/api/campaigns/linkedin/execute-live', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-trigger': 'cron-pending-prospects'
  },
  body: JSON.stringify({
    campaignId: campaignId,
    maxProspects: 1,
    dryRun: false
  })
});

const data = await response.json();

console.log('Response:', JSON.stringify(data, null, 2));

if (data.failed && data.failed.length > 0) {
  console.log('\n❌ FAILURE DETAILS:');
  data.failed.forEach(f => {
    console.log(`\nProspect: ${f.prospect}`);
    console.log(`Error: ${f.error}`);
  });
}
