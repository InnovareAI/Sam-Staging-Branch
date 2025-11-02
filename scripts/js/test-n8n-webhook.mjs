#!/usr/bin/env node
import 'dotenv/config';

const N8N_WEBHOOK = process.env.N8N_CAMPAIGN_WEBHOOK_URL || 'https://innovareai.app.n8n.cloud/webhook/campaign-execute';
const campaignId = '5067bfd4-e4c6-4082-a242-04323c8860c8';
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('🧪 Testing N8N webhook with minimal payload\n');
console.log(`Webhook URL: ${N8N_WEBHOOK}\n`);

// Minimal test payload
const testPayload = {
  campaign_id: campaignId,
  workspace_id: workspaceId,
  workspace_tier: 'startup',
  campaign_type: 'connector',
  prospects: [
    {
      id: 'test-1',
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      linkedin_url: 'https://linkedin.com/in/test'
    }
  ]
};

console.log('Sending payload:', JSON.stringify(testPayload, null, 2));
console.log('');

try {
  const response = await fetch(N8N_WEBHOOK, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.N8N_API_KEY || ''}`,
      'X-SAM-Workspace-ID': workspaceId,
      'X-SAM-Campaign-ID': campaignId
    },
    body: JSON.stringify(testPayload)
  });

  console.log(`Response status: ${response.status} ${response.statusText}`);
  
  const responseText = await response.text();
  console.log('Response body:', responseText);

  if (!response.ok) {
    console.log('\n❌ N8N webhook failed');
  } else {
    console.log('\n✅ N8N webhook succeeded');
  }
} catch (error) {
  console.error('❌ Request failed:', error.message);
}
