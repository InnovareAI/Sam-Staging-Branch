#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const N8N_API_KEY = 'n8n_api_DwPOv7QQDUt5NKbCVS60JUzxwDdNCQMGjNd4';
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

console.log('\n🔍 Fetching N8N workflow to fix status update...\n');

// Get current workflow
const getResponse = await fetch(`https://workflows.innovareai.com/api/v1/workflows/${WORKFLOW_ID}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'accept': 'application/json'
  }
});

if (!getResponse.ok) {
  console.error(`❌ Failed to fetch workflow: ${getResponse.status}`);
  process.exit(1);
}

const workflow = await getResponse.json();

console.log('Looking for "Update Status - CR Sent" node...\n');

// Find the status update node
const statusNode = workflow.nodes.find(n => n.name === 'Update Status - CR Sent');

if (!statusNode) {
  console.error('❌ Could not find "Update Status - CR Sent" node');
  process.exit(1);
}

console.log('Current node configuration:');
console.log(JSON.stringify(statusNode.parameters, null, 2));
console.log();

// The issue is likely in the body parameters
// Let's check if it's trying to send prospect data correctly
if (statusNode.parameters?.options?.bodyParametersUi?.parameter) {
  console.log('Body parameters:');
  console.log(JSON.stringify(statusNode.parameters.options.bodyParametersUi.parameter, null, 2));
}

console.log('\nTo fix this, the node should send:');
console.log(JSON.stringify({
  prospect_id: '={{ $input.item.json.prospect.id }}',
  status: 'connection_request_sent',
  contacted_at: '={{ $now.toISO() }}',
  invitation_id: '={{ $json.invitation_id }}'
}, null, 2));

