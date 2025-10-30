#!/usr/bin/env node
import fetch from 'node-fetch';

async function test() {
  console.log('Testing campaign 73bedc34 (test 9)...\n');
  
  const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-trigger': 'cron-pending-prospects'
    },
    body: JSON.stringify({
      campaignId: '73bedc34-3b24-4315-8cf1-043e454019af',
      maxProspects: 1,
      dryRun: true
    })
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

test();
