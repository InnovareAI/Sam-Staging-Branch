#!/usr/bin/env node
import 'dotenv/config';

// Test the cron endpoint to see if it's working
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';
const cronUrl = `${baseUrl}/api/cron/process-pending-prospects`;

console.log('🧪 Testing cron endpoint...');
console.log('URL:', cronUrl);
console.log();

try {
  const response = await fetch(cronUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': process.env.CRON_SECRET || '',
      'x-internal-trigger': 'test'
    }
  });

  console.log('Response status:', response.status);
  
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  if (data.results) {
    console.log('\n📊 Results:');
    data.results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.prospect_name} (${r.campaign_name}): ${r.status}`);
      if (r.error) {
        console.log(`   Error: ${r.error}`);
      }
    });
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
