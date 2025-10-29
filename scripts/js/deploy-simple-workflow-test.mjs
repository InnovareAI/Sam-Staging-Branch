#!/usr/bin/env node
/**
 * Deploy SIMPLE test workflow - NO Switch nodes, just webhook → function → send
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

async function makeN8NRequest(endpoint, method = 'GET', body = null) {
  const url = `${N8N_API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`N8N API error ${response.status}: ${errorText}`);
  }
  return await response.json();
}

const simpleWorkflow = {
  name: "SAM Master Campaign Orchestrator",
  nodes: [
    {
      id: "webhook_trigger",
      name: "Campaign Execute Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [250, 300],
      webhookId: "campaign-execute",
      parameters: {
        path: "campaign-execute",
        httpMethod: "POST",
        responseMode: "onReceived",
        options: { rawBody: false }
      }
    },
    {
      id: "log_webhook_data",
      name: "Log Webhook Data",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        functionCode: `
// Log incoming data
console.log('✅ WEBHOOK DATA RECEIVED:', JSON.stringify($input.all(), null, 2));

// Pass through the data
return $input.all();
        `
      }
    }
  ],

  connections: {
    webhook_trigger: { main: [[{ node: "log_webhook_data", type: "main", index: 0 }]] }
  },

  settings: {
    executionOrder: "v1",
    timezone: "America/New_York",
    saveManualExecutions: true,
    saveExecutionProgress: true,
    saveDataSuccessExecution: "all",
    saveDataErrorExecution: "all",
    executionTimeout: 3600
  }
};

console.log('🧪 Deploying SIMPLE test workflow...\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', simpleWorkflow);

  console.log('✅ SIMPLE TEST WORKFLOW DEPLOYED!\n');
  console.log('📋 Workflow:');
  console.log('   Webhook → Log Function');
  console.log('\n🎯 Test with: node scripts/js/test-webhook-direct.mjs');
  console.log('   Should execute function and log data to console\n');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
