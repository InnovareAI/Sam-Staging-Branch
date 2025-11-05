#!/usr/bin/env node

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'MlOCPY7qzZ2nEuue';

const response = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

const workflow = await response.json();

console.log('Workflow ID:', workflow.id);
console.log('Name:', workflow.name);
console.log('Active:', workflow.active);
console.log('Updated:', new Date(workflow.updatedAt).toLocaleString());

console.log('\nWebhook node config:');
const webhookNode = workflow.nodes?.find(n => n.type === 'n8n-nodes-base.webhook');
if (webhookNode) {
  console.log('  Name:', webhookNode.name);
  console.log('  HTTP Method:', webhookNode.parameters?.httpMethod);
  console.log('  Path:', webhookNode.parameters?.path);
  console.log('  Webhook ID:', webhookNode.webhookId);
  console.log('  Response Mode:', webhookNode.parameters?.responseMode);
  console.log('  Response Data:', webhookNode.parameters?.responseData);
  console.log('  Options:', JSON.stringify(webhookNode.parameters?.options, null, 2));

  console.log('\n✅ Webhook should be available at:');
  console.log(`   https://workflows.innovareai.com/webhook/${webhookNode.parameters?.path}`);
} else {
  console.log('  ❌ No webhook node found!');
}

console.log('\n🔍 All node types in workflow:');
workflow.nodes?.forEach(n => {
  console.log(`  - ${n.name} (${n.type})`);
});
