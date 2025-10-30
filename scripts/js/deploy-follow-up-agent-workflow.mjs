#!/usr/bin/env node
/**
 * Deploy N8N Follow-up Agent Workflow
 * Polls follow_ups_ready_to_send every minute and sends automated follow-ups
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY environment variable is required');
  process.exit(1);
}

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

console.log('🚀 Deploying Follow-up Agent Workflow...\n');

// Read the workflow JSON
const workflowPath = join(__dirname, 'n8n-follow-up-agent-workflow.json');
const workflowData = JSON.parse(readFileSync(workflowPath, 'utf-8'));

console.log('📋 Workflow details:');
console.log(`   Name: ${workflowData.name}`);
console.log(`   Type: Schedule Trigger (polls every 60 seconds)`);
console.log(`   Nodes: ${workflowData.nodes.length}`);
console.log(`   Purpose: Automated prospect re-engagement`);
console.log('');

try {
  // Check if workflow with this name already exists
  console.log('🔍 Checking for existing workflow...');
  const workflows = await makeN8NRequest('/workflows');
  const existingWorkflow = workflows.data?.find(w => w.name === workflowData.name);

  let workflowId;

  // Filter settings to only include accepted properties
  const acceptedSettings = {};
  if (workflowData.settings) {
    const allowedSettingsKeys = [
      'executionOrder',
      'saveManualExecutions',
      'saveDataErrorExecution',
      'saveDataSuccessExecution',
      'saveExecutionProgress'
    ];
    for (const key of allowedSettingsKeys) {
      if (workflowData.settings[key] !== undefined) {
        acceptedSettings[key] = workflowData.settings[key];
      }
    }
  }

  const payload = {
    name: workflowData.name,
    nodes: workflowData.nodes,
    connections: workflowData.connections,
    settings: acceptedSettings,
    staticData: workflowData.staticData || null
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

  // Activate the workflow
  console.log('\n🔄 Activating workflow...');
  await makeN8NRequest(`/workflows/${workflowId}/activate`, 'POST');

  console.log('\n✅ Follow-up Agent Workflow deployed and activated!\n');
  console.log('📊 Workflow Summary:');
  console.log(`   - Workflow ID: ${workflowId}`);
  console.log(`   - Status: Active`);
  console.log(`   - Polling: Every 60 seconds`);
  console.log(`   - Endpoint: https://app.meet-sam.com/api/follow-ups/poll-ready`);
  console.log('');
  console.log('🎯 Next Steps:');
  console.log('   1. Verify workflow is running in N8N dashboard');
  console.log('   2. Check logs: https://workflows.innovareai.com');
  console.log('   3. Test with a prospect that has gone silent');
  console.log('   4. Monitor follow-up generation in database');
  console.log('');
  console.log('📚 Workflow Logic:');
  console.log('   • Polls follow_ups_ready_to_send view every minute');
  console.log('   • Generates AI-powered follow-ups (gentle/value-add/final-attempt)');
  console.log('   • Queues messages to message_outbox');
  console.log('   • Updates follow-up status after queueing');
  console.log('   • Waits 30 seconds between each follow-up');
  console.log('');

} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
}
