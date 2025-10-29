#!/usr/bin/env node
import 'dotenv/config';

console.log('🧪 Testing Automatic Campaign Execution\n');
console.log('This simulates what the cron service will do every 2 minutes.\n');

const baseUrl = 'https://app.meet-sam.com';
const endpoint = `${baseUrl}/api/cron/process-pending-prospects`;

console.log(`Calling: ${endpoint}`);
console.log('Method: POST\n');

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-trigger': 'external-cron'
    }
  });

  console.log('Response Status:', response.status);
  
  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Error:', error);
    process.exit(1);
  }

  const data = await response.json();
  
  console.log('\n✅ SUCCESS! API is working\n');
  console.log('Result:', JSON.stringify(data, null, 2));
  
  if (data.results) {
    console.log('\n📊 Processed Prospects:');
    data.results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.prospect_name} (${r.campaign_name})`);
      console.log(`   Status: ${r.status}`);
      console.log(`   Message: ${r.message || r.error}`);
    });
  }
  
  console.log('\n\n✅ API READY FOR AUTOMATION');
  console.log('Set up external cron using instructions above.');
  
} catch (error) {
  console.error('❌ Failed:', error.message);
  process.exit(1);
}
