#!/usr/bin/env node
/**
 * Add automatic execution tagging to N8N workflow
 * Tags each execution with workspace + campaign name automatically
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY not found');
  process.exit(1);
}

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

console.log('🏷️  Adding auto-tagging to N8N workflow...\n');

// Get current workflow
const workflow = await makeN8NRequest(`/workflows/${WORKFLOW_ID}`);

// Add auto-tagging node at the end
const autoTagNode = {
  id: "auto_tag_execution",
  name: "Auto-Tag Execution",
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: [2500, 300],
  parameters: {
    method: "PATCH",
    url: `={{ "${N8N_API_URL}/executions/" + $execution.id }}`,
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth",
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: "X-N8N-API-KEY",
          value: `={{ "${N8N_API_KEY}" }}`
        }
      ]
    },
    sendBody: true,
    contentType: "json",
    bodyParameters: {
      parameters: [
        {
          name: "tags",
          value: `={{ ["ws:" + $('Campaign Execute Webhook').item.json.workspace_name, "campaign:" + $('Campaign Execute Webhook').item.json.campaign_name, "account:" + $('Campaign Execute Webhook').item.json.linkedin_account_name] }}`
        }
      ]
    },
    options: {
      timeout: 5000,
      redirect: {
        redirect: {}
      }
    }
  }
};

// Add the node to workflow
workflow.nodes.push(autoTagNode);

// Update workflow to include the auto-tag node in connections
// Connect from webhook trigger to auto-tag (runs in parallel with main flow)
if (!workflow.connections["Campaign Execute Webhook"]) {
  workflow.connections["Campaign Execute Webhook"] = { main: [[]] };
}

// Add connection to auto-tag node
workflow.connections["Campaign Execute Webhook"].main[0].push({
  node: "auto_tag_execution",
  type: "main",
  index: 0
});

// Update workflow
await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', workflow);

console.log('✅ AUTO-TAGGING ENABLED!\n');
console.log('📋 How it works:');
console.log('   • Every execution automatically tagged');
console.log('   • Tags: ws:[workspace], campaign:[name], account:[linkedin]');
console.log('   • Runs immediately on webhook trigger');
console.log('   • Zero manual work required\n');
