#!/usr/bin/env node
/**
 * Deploy N8N Polling Workflow (Option 3 - Last Resort)
 * Polls API every 5 minutes instead of using webhooks
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

async function makeN8NRequest(endpoint, method = 'GET', body = null) {
  const response = await fetch(`${N8N_API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`N8N API error ${response.status}: ${text}`);
  }

  return await response.json();
}

console.log('📤 Deploying N8N Polling Workflow (Option 3)...\n');

// Read the workflow JSON
const workflowPath = join(__dirname, 'n8n-polling-workflow.json');
const workflowData = JSON.parse(readFileSync(workflowPath, 'utf-8'));

console.log('📋 Workflow details:');
console.log(`   Name: ${workflowData.name}`);
console.log(`   Type: Schedule Trigger (polls every 5 minutes)`);
console.log(`   Nodes: ${workflowData.nodes.length}`);
console.log('');

try {
  // Check if workflow with this name already exists
  console.log('🔍 Checking for existing workflow...');
  const workflows = await makeN8NRequest('/workflows');
  const existingWorkflow = workflows.data?.find(w => w.name === workflowData.name);

  let workflowId;

  // Remove read-only fields
  const payload = {
    name: workflowData.name,
    nodes: workflowData.nodes,
    connections: workflowData.connections,
    settings: workflowData.settings
  };

  if (existingWorkflow) {
    console.log(`✅ Found existing workflow: ${existingWorkflow.id}`);
    console.log('📝 Updating existing workflow...\n');

    await makeN8NRequest(`/workflows/${existingWorkflow.id}`, 'PUT', payload);
    workflowId = existingWorkflow.id;

    console.log('✅ Workflow updated!');
  } else {
    console.log('📝 Creating new workflow...\n');

    // Create new workflow
    const result = await makeN8NRequest('/workflows', 'POST', payload);
    workflowId = result.id;

    console.log('✅ Workflow created!');
    console.log(`   ID: ${workflowId}`);
  }

  console.log('');
  console.log('🔧 Workflow architecture:');
  console.log('   1. Schedule Trigger → Runs every 5 minutes');
  console.log('   2. HTTP GET /api/campaigns/poll-pending');
  console.log('   3. Check if prospects exist');
  console.log('   4. Loop through prospects');
  console.log('   5. Send CR via Unipile');
  console.log('   6. Update prospect status via API');
  console.log('   7. Log result and check for more');
  console.log('');

  console.log('⚠️  IMPORTANT: Workflow is NOT activated yet');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Go to N8N UI: https://workflows.innovareai.com');
  console.log(`   2. Open workflow: "${workflowData.name}"`);
  console.log('   3. Click "Test workflow" to verify it works');
  console.log('   4. Toggle "Active" to enable 5-minute polling');
  console.log('');
  console.log('🎯 Advantages of polling:');
  console.log('   ✅ No webhook registration issues');
  console.log('   ✅ Works reliably with N8N API deployment');
  console.log('   ✅ Automatic retry every 5 minutes');
  console.log('   ✅ Can process multiple campaigns in batches');
  console.log('');
  console.log('⚠️  Note: Slightly delayed (up to 5 minutes) vs real-time webhooks');
  console.log('');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
