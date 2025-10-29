#!/usr/bin/env node
/**
 * Test: Webhook → Handler → Prepare Prospects → Log
 * NO HTTP, NO LOOP - just test the prospect flattening
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

const testWorkflow = {
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
const data = $input.item.json.body || $input.item.json;
console.log('📨 Campaign Handler received:', JSON.stringify(data, null, 2));

return [{
  json: {
    campaign_name: data.campaign_name,
    prospects: data.prospects || [],
    messages: data.messages || {},
    unipile_dsn: data.unipile_dsn,
    unipile_api_key: data.unipile_api_key,
    unipile_account_id: data.unipile_account_id
  }
}];
        `
      }
    },
    {
      id: "prepare_prospects",
      name: "Prepare Prospects List",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [650, 300],
      parameters: {
        functionCode: `
const campaignData = $input.item.json;

console.log('📋 Flattening', campaignData.prospects.length, 'prospects');

return campaignData.prospects.map(prospect => ({
  json: {
    prospect_id: prospect.id,
    first_name: prospect.first_name,
    last_name: prospect.last_name,
    linkedin_url: prospect.linkedin_url,
    campaign_name: campaignData.campaign_name,
    unipile_dsn: campaignData.unipile_dsn,
    unipile_api_key: campaignData.unipile_api_key,
    unipile_account_id: campaignData.unipile_account_id,
    messages: campaignData.messages
  }
}));
        `
      }
    }
  ],
  connections: {
    "Campaign Execute Webhook": { main: [[{ node: "Campaign Handler", type: "main", index: 0 }]] },
    "Campaign Handler": { main: [[{ node: "Prepare Prospects List", type: "main", index: 0 }]] }
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

console.log('🧪 Deploying test: Prepare Prospects workflow...\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', testWorkflow);
  console.log('✅ TEST WORKFLOW DEPLOYED!\n');
  console.log('📋 Flow: Webhook → Handler → Prepare Prospects\n');
  console.log('🎯 Test with: node scripts/js/test-webhook-direct.mjs\n');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
