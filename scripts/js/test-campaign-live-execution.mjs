#!/usr/bin/env node
import fetch from 'node-fetch';

async function test() {
  console.log('🚀 Testing LIVE campaign execution (will trigger N8N)...\n');
  
  const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-trigger': 'cron-pending-prospects'
    },
    body: JSON.stringify({
      campaignId: '73bedc34-3b24-4315-8cf1-043e454019af',
      maxProspects: 1,
      dryRun: false  // LIVE EXECUTION
    })
  });

  const data = await response.json();
  console.log('📊 Response:\n');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.n8n_triggered) {
    console.log('\n✅ N8N webhook triggered successfully!');
    console.log(`   Queued prospects: ${data.messages_queued || 0}`);
  } else {
    console.log('\n⚠️  N8N webhook was NOT triggered');
  }
}

test();
