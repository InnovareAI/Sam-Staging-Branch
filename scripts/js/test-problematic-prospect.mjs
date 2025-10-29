#!/usr/bin/env node
import 'dotenv/config';

// Test the specific prospect that's failing
console.log('🧪 Testing Problematic Prospect\n');

const campaignId = 'a06abf27-4d2b-4f1b-b766-fbf3345f14fc';
const prospectLinkedIn = 'https://www.linkedin.com/in/dominicwong1?miniProfileUrn=urn%3Ali%3Afs_miniProfile%3AACoAAATsfu4Bt3tGLZH7NvNytLshMewA4nGy2H0';

console.log('Campaign: 20251028-IAI-Mich Startup Canada');
console.log('Prospect: Dominic Wong');
console.log('LinkedIn URL:', prospectLinkedIn);
console.log();

// Extract username
const username = prospectLinkedIn.split('/in/')[1]?.split('?')[0];
console.log('Extracted username:', username);
console.log();

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
console.log('Result:', JSON.stringify(data, null, 2));
