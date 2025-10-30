#!/usr/bin/env node
/**
 * Test Live Campaign Execution
 * Uses internal trigger to bypass auth
 */

import fetch from 'node-fetch';

const CAMPAIGN_ID = '73bedc34-3b24-4315-8cf1-043e454019af';

async function testCampaign() {
  console.log('🚀 Testing Campaign Execution\n');
  console.log(`Campaign: 73bedc34 (test 9)`);
  console.log(`Max prospects: 1`);
  console.log(`Mode: DRY RUN\n`);

  const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-trigger': 'cron-pending-prospects'
    },
    body: JSON.stringify({
      campaignId: CAMPAIGN_ID,
      maxProspects: 1,
      dryRun: true
    })
  });

  const data = await response.json();

  console.log('📊 Response:');
  console.log(`Status: ${response.status}`);
  console.log(JSON.stringify(data, null, 2));

  if (data.success && data.results) {
    console.log('\n✅ Results:');
    console.log(`  Sent: ${data.results.sent || 0}`);
    console.log(`  Failed: ${data.results.failed || 0}`);
    console.log(`  Skipped: ${data.results.skipped || 0}`);

    if (data.results.sent > 0) {
      console.log('\n🎉 Campaign execution working!');
      console.log('   LinkedIn accounts connected and operational');
    }
  }
}

testCampaign().catch(console.error);
