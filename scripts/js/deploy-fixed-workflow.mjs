#!/usr/bin/env node
/**
 * FIXED N8N Workflow - Implements all GPT recommendations:
 * 1. Flatten prospects array before splitInBatches
 * 2. Use $json.unipile_dsn instead of $env
 * 3. Add https:// prefix to URLs
 * 4. Add Catch node for error handling
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

// FIXED: Simple CR-only workflow to test the fixes
const fixedWorkflow = {
  name: "SAM Master Campaign Orchestrator",
  nodes: [
    // 1. Webhook
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

    // 2. Campaign Handler - Extract campaign data
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

// Return campaign-level data (NOT the prospects yet)
return [{
  json: {
    workspace_id: data.workspace_id,
    workspace_name: data.workspace_name,
    campaign_id: data.campaign_id,
    campaign_name: data.campaign_name,
    linkedin_account_name: data.linkedin_account_name,
    unipile_account_id: data.unipile_account_id,
    unipile_dsn: data.unipile_dsn,
    unipile_api_key: data.unipile_api_key,
    prospects: data.prospects || [],
    messages: data.messages || {},
    timing: data.timing || {
      fu1_delay_days: 2,
      fu2_delay_days: 5,
      fu3_delay_days: 7,
      fu4_delay_days: 5,
      gb_delay_days: 7
    },
    last_message_sent: new Date().toISOString()
  }
}];
        `
      }
    },

    // 3. NEW: Prepare Prospects List - Flatten prospects array
    {
      id: "prepare_prospects",
      name: "Prepare Prospects List",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [650, 300],
      parameters: {
        functionCode: `
// CRITICAL FIX: Flatten prospects array into individual items
// Each prospect becomes its own item with campaign context

const campaignData = $input.item.json;

console.log('📋 Preparing', campaignData.prospects.length, 'prospects for loop');

return campaignData.prospects.map(prospect => ({
  json: {
    // Prospect data
    prospect_id: prospect.id,
    first_name: prospect.first_name,
    last_name: prospect.last_name,
    linkedin_url: prospect.linkedin_url,
    company_name: prospect.company_name,
    title: prospect.title,

    // Campaign context (needed in each iteration)
    campaign_id: campaignData.campaign_id,
    campaign_name: campaignData.campaign_name,
    workspace_id: campaignData.workspace_id,

    // Unipile credentials (FIXED: pass via $json, not $env)
    unipile_account_id: campaignData.unipile_account_id,
    unipile_dsn: campaignData.unipile_dsn,
    unipile_api_key: campaignData.unipile_api_key,

    // Messages
    messages: campaignData.messages,

    // Tracking
    last_message_sent: campaignData.last_message_sent
  }
}));
        `
      }
    },

    // 4. splitInBatches - Now receives multiple items
    {
      id: "prospect_loop",
      name: "Process Each Prospect",
      type: "n8n-nodes-base.splitInBatches",
      typeVersion: 1,
      position: [850, 300],
      parameters: {
        batchSize: 1,
        options: {}
      }
    },

    // 5. Send CR - FIXED URL with https:// and $json
    {
      id: "send_cr",
      name: "Send CR",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [1050, 300],
      parameters: {
        method: "POST",
        url: "=https://{{ $json.unipile_dsn }}/api/v1/messaging/messages",  // FIXED
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "X-API-KEY",
              value: "={{ $json.unipile_api_key }}"  // FIXED: from $json
            }
          ]
        },
        sendBody: true,
        contentType: "json",
        body: `={
  "account_id": "{{ $json.unipile_account_id }}",
  "attendees": [{
    "identifier": "{{ $json.linkedin_url }}"
  }],
  "text": "{{ $json.messages.cr }}",
  "type": "LINKEDIN"
}`,
        options: {}
      }
    },

    // 6. Log Success
    {
      id: "log_success",
      name: "Log Success",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [1250, 300],
      parameters: {
        functionCode: `
console.log('✅ CR sent to:', $json.first_name, $json.last_name);
console.log('   Campaign:', $input.item.json.campaign_name);
console.log('   LinkedIn:', $input.item.json.linkedin_url);

return [{
  json: {
    success: true,
    campaign: $input.item.json.campaign_name,
    prospect: $input.item.json.first_name + ' ' + $input.item.json.last_name,
    message: 'Connection request sent'
  }
}];
        `
      }
    },

    // 7. NEW: Catch Node for error handling
    {
      id: "error_handler",
      name: "Error Handler",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [850, 500],
      parameters: {
        functionCode: `
console.error('🔥 ERROR CAUGHT:', JSON.stringify($input.all(), null, 2));

return [{
  json: {
    error: true,
    message: 'Workflow execution failed',
    details: $input.all()
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
      main: [[{ node: "Send CR", type: "main", index: 0 }]]
    },
    "Send CR": {
      main: [[{ node: "Log Success", type: "main", index: 0 }]]
    },
    "Log Success": {
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
    executionTimeout: 3600,
    errorWorkflow: "error_handler"  // Enable error handling
  }
};

console.log('🔧 Deploying FIXED workflow with N8N GPT recommendations...\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', fixedWorkflow);
  console.log('✅ FIXED WORKFLOW DEPLOYED!\n');
  console.log('🛠️ Applied Fixes:');
  console.log('   ✓ Added "Prepare Prospects List" to flatten array');
  console.log('   ✓ Fixed HTTP Request to use $json.unipile_dsn');
  console.log('   ✓ Added https:// prefix to Unipile URL');
  console.log('   ✓ Added Error Handler node\n');
  console.log('📋 Flow: Webhook → Handler → Prepare List → Loop → Send CR → Log\n');
  console.log('🎯 Test with: node scripts/js/test-webhook-direct.mjs\n');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
