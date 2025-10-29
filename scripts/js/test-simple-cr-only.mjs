#!/usr/bin/env node
/**
 * SIMPLEST POSSIBLE CR WORKFLOW
 * Webhook → Handler → Prepare → Send CR (NO LOOP)
 * Just sends to the FIRST prospect
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
      id: "campaign_handler",
      name: "Campaign Handler",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        functionCode: `
const data = $input.item.json.body || $input.item.json;
console.log('📨 Campaign:', data.campaign_name);

return [{
  json: {
    campaign_name: data.campaign_name,
    prospect: data.prospects[0],  // Just first prospect
    messages: data.messages,
    unipile_dsn: data.unipile_dsn,
    unipile_api_key: data.unipile_api_key,
    unipile_account_id: data.unipile_account_id
  }
}];
        `
      }
    },
    {
      id: "send_cr",
      name: "Send CR",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [650, 300],
      parameters: {
        method: "POST",
        url: '={{ "https://" + $json.unipile_dsn + "/api/v1/messaging/messages" }}',
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "X-API-KEY",
              value: "={{ $json.unipile_api_key }}"
            }
          ]
        },
        sendBody: true,
        contentType: "json",
        body: `={
  "account_id": "{{ $json.unipile_account_id }}",
  "attendees": [{
    "identifier": "{{ $json.prospect.linkedin_url }}"
  }],
  "text": "{{ $json.messages.cr }}",
  "type": "LINKEDIN"
}`,
        options: {}
      }
    },
    {
      id: "log_result",
      name: "Log Result",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [850, 300],
      parameters: {
        functionCode: `
console.log('✅ Unipile response:', JSON.stringify($json, null, 2));

return [{
  json: {
    success: true,
    campaign: $('Campaign Handler').item.json.campaign_name,
    prospect: $('Campaign Handler').item.json.prospect.first_name + ' ' + $('Campaign Handler').item.json.prospect.last_name,
    unipile_response: $json,
    message: 'Connection request sent'
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
      main: [[{ node: "Send CR", type: "main", index: 0 }]]
    },
    "Send CR": {
      main: [[{ node: "Log Result", type: "main", index: 0 }]]
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

console.log('📤 Deploying SIMPLE CR-ONLY workflow (NO LOOP)...\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', simpleWorkflow);
  console.log('✅ SIMPLE CR-ONLY WORKFLOW DEPLOYED!\n');
  console.log('📋 Flow: Webhook → Handler → Send CR → Log\n');
  console.log('🎯 Test with: node scripts/js/test-webhook-direct.mjs\n');
  console.log('Expected: Should send CR to Unipile API and return response\n');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
