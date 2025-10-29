#!/usr/bin/env node
import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const executionId = process.argv[2] || '58943';

const response = await fetch(`${N8N_API_URL}/executions/${executionId}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const data = await response.json();

console.log('\n📊 Execution #' + executionId);
console.log('Status:', data.status);
console.log('Mode:', data.mode);
console.log('Started:', new Date(data.startedAt).toLocaleTimeString());
console.log('Stopped:', new Date(data.stoppedAt).toLocaleTimeString());
console.log('Duration:', ((new Date(data.stoppedAt) - new Date(data.startedAt)) / 1000).toFixed(2) + 's');

console.log('\n🔍 Nodes Executed:');
if (data.data?.resultData?.runData) {
  const nodeNames = Object.keys(data.data.resultData.runData);
  console.log('Count:', nodeNames.length);
  nodeNames.forEach(name => {
    console.log('  •', name);
  });
} else {
  console.log('  ❌ NO NODES EXECUTED');
}

console.log('\n❌ Error Details:');
if (data.data?.resultData?.error) {
  console.log(JSON.stringify(data.data.resultData.error, null, 2));
} else {
  console.log('  No errors recorded');
}

console.log('\n📦 Webhook Data Received:');
const webhookData = data.data?.resultData?.runData?.['Campaign Execute Webhook']?.[0]?.data?.main?.[0]?.[0]?.json;
if (webhookData) {
  console.log('  Workspace:', webhookData.workspace_name);
  console.log('  Campaign:', webhookData.campaign_name);
  console.log('  Prospects:', webhookData.prospects?.length);
} else {
  console.log('  ❌ NO WEBHOOK DATA');
}
