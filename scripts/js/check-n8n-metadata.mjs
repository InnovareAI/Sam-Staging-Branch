#!/usr/bin/env node
import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY not found');
  process.exit(1);
}

const executionId = process.argv[2] || '58935';

const response = await fetch(`${N8N_API_URL}/executions/${executionId}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

if (!response.ok) {
  console.error(`❌ Failed to fetch execution: ${response.status}`);
  process.exit(1);
}

const data = await response.json();
const webhookData = data.data?.resultData?.runData?.['Campaign Execute Webhook']?.[0]?.data?.main?.[0]?.[0]?.json;

console.log('\n📦 N8N Execution #' + executionId);
console.log('Status:', data.status);
console.log('Duration:', data.stoppedAt ? ((new Date(data.stoppedAt) - new Date(data.startedAt)) / 1000).toFixed(2) + 's' : 'N/A');

console.log('\n🏷️  Metadata received:');
console.log('  Workspace:', webhookData?.workspace_name || '❌ MISSING');
console.log('  Campaign:', webhookData?.campaign_name || '❌ MISSING');
console.log('  LinkedIn Account:', webhookData?.linkedin_account_name || '❌ MISSING');

console.log('\n📋 Full webhook payload:');
console.log(JSON.stringify(webhookData, null, 2));
