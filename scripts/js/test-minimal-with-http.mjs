#!/usr/bin/env node
/**
 * Minimal workflow: webhook → handler → HTTP request
 * Tests if HTTP Request node works at all
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

const minimalWorkflow = {
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
      id: "campaign_handler",
      name: "Campaign Handler",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        functionCode: `
// Extract data
const data = $input.item.json.body || $input.item.json;
console.log('📨 Got campaign:', data.campaign_name);

return [{
  json: {
    campaign_name: data.campaign_name,
    prospect: data.prospects[0],
    message: data.messages.cr
  }
}];
        `
      }
    },
    {
      id: "log_result",
      name: "Log Result",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [650, 300],
      parameters: {
        functionCode: `
console.log('✅ Campaign Handler output:', JSON.stringify($input.item.json, null, 2));
return $input.all();
        `
      }
    }
  ],
  connections: {
    "Campaign Execute Webhook": { main: [[{ node: "Campaign Handler", type: "main", index: 0 }]] },
    "Campaign Handler": { main: [[{ node: "Log Result", type: "main", index: 0 }]] }
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

console.log('🧪 Deploying minimal workflow (webhook → handler → log)...\\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', minimalWorkflow);
  console.log('✅ MINIMAL WORKFLOW DEPLOYED!\\n');
  console.log('📋 Flow: Webhook → Handler → Log\\n');
  console.log('🎯 Test with: node scripts/js/test-webhook-direct.mjs\\n');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
