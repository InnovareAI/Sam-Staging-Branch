#!/usr/bin/env node
/**
 * Create ULTRA-SIMPLE CR workflow - Just webhook → function → HTTP request
 * For debugging only
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

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
    throw new Error(`N8N API error ${response.status}: ${await response.text()}`);
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
      typeVersion: 2.1,
      position: [250, 300],
      webhookId: "campaign-execute",
      parameters: {
        path: "campaign-execute",
        httpMethod: "POST",
        responseMode: "lastNode",
        options: {}
      }
    },
    {
      id: "log_data",
      name: "Log Webhook Data",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        functionCode: `
console.log('📨 WEBHOOK RECEIVED:', JSON.stringify($input.all(), null, 2));

// Extract data
const data = $input.all()[0].json.body;

console.log('✅ Workspace:', data.workspace_name);
console.log('✅ Campaign:', data.campaign_name);
console.log('✅ Prospects:', data.prospects?.length || 0);

return [{
  json: {
    success: true,
    workspace: data.workspace_name,
    campaign: data.campaign_name,
    prospects: data.prospects?.length || 0,
    message: 'Webhook processed successfully'
  }
}];
        `
      }
    }
  ],
  connections: {
    "Campaign Execute Webhook": {
      main: [[{
        node: "Log Webhook Data",
        type: "main",
        index: 0
      }]]
    }
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

console.log('🧪 Deploying ULTRA-SIMPLE workflow for debugging...\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', simpleWorkflow);
  console.log('✅ ULTRA-SIMPLE WORKFLOW DEPLOYED!\n');
  console.log('📋 Workflow: Webhook → Log Function (no external APIs)\n');
  console.log('🎯 Test with: node scripts/js/test-webhook-direct.mjs\n');
  console.log('   Expected: Function should log workspace/campaign data\n');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
