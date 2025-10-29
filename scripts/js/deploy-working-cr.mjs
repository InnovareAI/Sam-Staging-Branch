#!/usr/bin/env node
import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

async function makeN8NRequest(endpoint, method = 'GET', body = null) {
  const response = await fetch(`${N8N_API_URL}${endpoint}`, {
    method, headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_API_KEY },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw new Error(`N8N API error ${response.status}: ${await response.text()}`);
  return await response.json();
}

const workflow = {
  name: "SAM Master Campaign Orchestrator",
  nodes: [
    {
      id: "webhook", name: "Campaign Execute Webhook", type: "n8n-nodes-base.webhook", typeVersion: 2.1, position: [250, 300],
      webhookId: "campaign-execute",
      parameters: { path: "campaign-execute", httpMethod: "POST", responseMode: "lastNode", options: {} }
    },
    {
      id: "handler", name: "Campaign Handler", type: "n8n-nodes-base.function", typeVersion: 1, position: [450, 300],
      parameters: {
        functionCode: `
const data = $input.item.json.body || $input.item.json;
const prospect = data.prospects[0];

return [{
  json: {
    unipile_url: 'https://' + data.unipile_dsn + '/api/v1/messaging/messages',
    unipile_api_key: data.unipile_api_key,
    unipile_account_id: data.unipile_account_id,
    linkedin_url: prospect.linkedin_url,
    message: data.messages.cr,
    prospect_name: prospect.first_name + ' ' + prospect.last_name,
    campaign_name: data.campaign_name
  }
}];
        `
      }
    },
    {
      id: "send_cr", name: "Send CR", type: "n8n-nodes-base.httpRequest", typeVersion: 3, position: [650, 300],
      parameters: {
        method: "POST",
        url: "={{ $json.unipile_url }}",
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "X-API-KEY", value: "={{ $json.unipile_api_key }}" }] },
        sendBody: true,
        contentType: "json",
        bodyParameters: {
          parameters: [
            { name: "account_id", value: "={{ $json.unipile_account_id }}" },
            { name: "attendees[0][identifier]", value: "={{ $json.linkedin_url }}" },
            { name: "text", value: "={{ $json.message }}" },
            { name: "type", value: "LINKEDIN" }
          ]
        },
        options: {}
      }
    }
  ],
  connections: {
    "Campaign Execute Webhook": { main: [[{ node: "Campaign Handler", type: "main", index: 0 }]] },
    "Campaign Handler": { main: [[{ node: "Send CR", type: "main", index: 0 }]] }
  },
  settings: { executionOrder: "v1", timezone: "America/New_York", saveManualExecutions: true, executionTimeout: 3600 }
};

await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', workflow);
console.log('✅ WORKING CR WORKFLOW DEPLOYED!\n');
