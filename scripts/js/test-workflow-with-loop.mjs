#!/usr/bin/env node
/**
 * Test workflow: webhook → handler → loop prospects → log each
 * No HTTP requests - just test the loop works
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

const testWorkflowWithLoop = {
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
// Extract data from webhook body
const data = $input.item.json.body || $input.item.json;

console.log('📨 Campaign Handler received:', JSON.stringify(data, null, 2));

return [{
  json: {
    workspace_id: data.workspace_id,
    campaign_id: data.campaign_id,
    campaign_name: data.campaign_name,
    prospects: data.prospects || [],
    message_count: Object.keys(data.messages || {}).length
  }
}];
        `
      }
    },
    {
      id: "prospect_loop",
      name: "Process Each Prospect",
      type: "n8n-nodes-base.splitInBatches",
      typeVersion: 1,
      position: [650, 300],
      parameters: {
        batchSize: 1,
        options: {}
      }
    },
    {
      id: "log_prospect",
      name: "Log Prospect",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [850, 300],
      parameters: {
        functionCode: `
const prospect = $input.item.json.prospects[$item(0).$itemIndex];

console.log('👤 Processing prospect:', prospect.first_name, prospect.last_name);

return [{
  json: {
    prospect_name: prospect.first_name + ' ' + prospect.last_name,
    linkedin_url: prospect.linkedin_url,
    index: $item(0).$itemIndex
  }
}];
        `
      }
    }
  ],
  connections: {
    "Campaign Execute Webhook": { main: [[{ node: "Campaign Handler", type: "main", index: 0 }]] },
    "Campaign Handler": { main: [[{ node: "Process Each Prospect", type: "main", index: 0 }]] },
    "Process Each Prospect": { main: [[{ node: "Log Prospect", type: "main", index: 0 }]] },
    "Log Prospect": { main: [[{ node: "Process Each Prospect", type: "main", index: 0 }]] }
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

console.log('🧪 Deploying test workflow with loop...\\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', testWorkflowWithLoop);
  console.log('✅ TEST WORKFLOW WITH LOOP DEPLOYED!\\n');
  console.log('📋 Flow: Webhook → Handler → Loop Prospects → Log Each\\n');
  console.log('🎯 Test with: node scripts/js/test-webhook-direct.mjs\\n');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
