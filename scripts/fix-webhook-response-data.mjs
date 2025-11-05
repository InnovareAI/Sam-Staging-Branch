#!/usr/bin/env node

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'MlOCPY7qzZ2nEuue';

console.log('📥 Fetching current workflow...\n');

// Get current workflow
const getResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

const workflow = await getResponse.json();

console.log('Current webhook node config:');
const webhookNode = workflow.nodes?.find(n => n.type === 'n8n-nodes-base.webhook');
console.log('  Response Mode:', webhookNode.parameters?.responseMode);
console.log('  Response Data:', webhookNode.parameters?.responseData);

// Fix the webhook node
webhookNode.parameters.responseData = 'firstEntryJson';

console.log('\n✏️  Updated webhook node config:');
console.log('  Response Mode:', webhookNode.parameters.responseMode);
console.log('  Response Data:', webhookNode.parameters.responseData);

console.log('\n📤 Updating workflow...\n');

// Update workflow
const updateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings
  })
});

if (updateResponse.ok) {
  console.log('✅ Workflow updated successfully!');
  console.log('\n⚠️  Now you need to:');
  console.log('1. Deactivate the workflow (toggle OFF)');
  console.log('2. Wait 2 seconds');
  console.log('3. Activate the workflow (toggle ON)');
  console.log('4. Test again');
} else {
  const error = await updateResponse.text();
  console.error('❌ Failed to update workflow:', error);
}
