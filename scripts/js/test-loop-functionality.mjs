#!/usr/bin/env node
/**
 * Test: Webhook → Handler → Prepare → LOOP → Log each prospect
 * Tests if splitInBatches works with flattened prospects
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
console.log('📨 Campaign Handler received campaign:', data.campaign_name);

return [{
  json: {
    campaign_id: data.campaign_id,
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
    },
    {
      id: "prospect_loop",
      name: "Process Each Prospect",
      type: "n8n-nodes-base.splitInBatches",
      typeVersion: 3,
      position: [850, 300],
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
      position: [1050, 300],
      parameters: {
        functionCode: `
console.log('👤 Processing prospect:', $json.first_name, $json.last_name);
console.log('   Campaign:', $json.campaign_name);
console.log('   LinkedIn:', $json.linkedin_url);

return [{
  json: {
    prospect: $json.first_name + ' ' + $json.last_name,
    campaign: $json.campaign_name,
    iteration: $item(0).$itemIndex + 1
  }
}];
        `
      }
    }
  ],
  connections: {
    "Campaign Execute Webhook": {
      main: [[{ node: "Campaign Handler", type: "main", index: 0 }]]
    },
    "Campaign Handler": {
      main: [[{ node: "Prepare Prospects List", type: "main", index: 0 }]]
    },
    "Prepare Prospects List": {
      main: [[{ node: "Process Each Prospect", type: "main", index: 0 }]]
    },
    "Process Each Prospect": {
      main: [[{ node: "Log Prospect", type: "main", index: 0 }]]
    },
    "Log Prospect": {
      main: [[{ node: "Process Each Prospect", type: "main", index: 0 }]]  // Loop back
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

console.log('🔁 Deploying LOOP TEST workflow...\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', testWorkflow);
  console.log('✅ LOOP TEST WORKFLOW DEPLOYED!\n');
  console.log('📋 Flow: Webhook → Handler → Prepare → LOOP → Log\n');
  console.log('🎯 Test with: node scripts/js/test-webhook-direct.mjs\n');
  console.log('Expected: Should return last prospect after looping through all\n');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
