#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

console.log('🔧 Fixing Orchestrator Webhook Response Mode\n');

// Get current workflow
const getResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const workflow = await getResponse.json();

// Find webhook node
const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');

console.log('Current webhook config:');
console.log(`  Response Mode: ${webhookNode.parameters.responseMode || 'onReceived'}`);
console.log(`  Response Data: ${webhookNode.parameters.responseData || 'default'}`);

// Update webhook node to use lastNode response mode
webhookNode.parameters.responseMode = 'lastNode';
webhookNode.parameters.responseData = 'allEntries';

console.log('\nUpdated webhook config:');
console.log(`  Response Mode: ${webhookNode.parameters.responseMode}`);
console.log(`  Response Data: ${webhookNode.parameters.responseData}`);

// Create clean workflow object with only required fields
const updatePayload = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
  staticData: workflow.staticData,
  pinData: workflow.pinData || {}
};

// Update workflow
const updateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(updatePayload)
});

if (updateResponse.ok) {
  console.log('\n✅ Workflow updated successfully!');
  console.log('   Webhook will now process all nodes before responding.\n');
} else {
  const error = await updateResponse.text();
  console.error(`\n❌ Failed to update workflow: ${updateResponse.status}`);
  console.error(error);
}
