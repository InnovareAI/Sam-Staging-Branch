#!/usr/bin/env node
import 'dotenv/config';

// Test sending to a single prospect with the enrichment fix
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

// Your campaign ID
const campaignId = '8ba7f767-42a9-4c44-808a-b244e9afdd32';

console.log('🧪 Testing connection request with enrichment fix...');
console.log('Campaign: 20251029-IAI-Outreach Campaign');
console.log();

try {
  const response = await fetch(`${baseUrl}/api/campaigns/linkedin/execute-live`, {
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

  console.log('Response status:', response.status);
  
  const data = await response.json();
  console.log('\nResponse:', JSON.stringify(data, null, 2));
  
  if (data.failed && data.failed.length > 0) {
    console.log('\n❌ FAILURES:');
    data.failed.forEach((f, i) => {
      console.log(`${i + 1}. ${f.prospect}`);
      console.log(`   Error: ${f.error}`);
    });
  }
  
  if (data.sent_to && data.sent_to.length > 0) {
    console.log('\n✅ SUCCESS:');
    data.sent_to.forEach((s, i) => {
      console.log(`${i + 1}. ${s.prospect}`);
      console.log(`   LinkedIn: ${s.linkedin_url}`);
    });
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
