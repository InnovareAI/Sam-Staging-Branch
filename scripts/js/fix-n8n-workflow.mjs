#!/usr/bin/env node
/**
 * Fix N8N Workflow - Add Unipile Integration
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const N8N_API_URL = process.env.N8N_API_BASE_URL || process.env.N8N_INSTANCE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Fixing N8N Campaign Workflow\n');

// Complete N8N workflow that handles campaign execution
const campaignWorkflow = {
  "name": "Campaign Execute - LinkedIn via Unipile",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "campaign-execute",
        "responseMode": "onReceived",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300],
      "webhookId": "campaign-execute"
    },
    {
      "parameters": {
        "functionCode": "// Extract prospects from webhook payload\nconst prospects = $input.item.json.prospects || [];\nconst campaign = $input.item.json.campaign || {};\nconst messages = $input.item.json.messages || {};\n\nconsole.log(`Processing ${prospects.length} prospects`);\n\n// Return each prospect as a separate item for processing\nreturn prospects.map(prospect => ({\n  json: {\n    prospect,\n    campaign,\n    messages,\n    unipile_dsn: $env.UNIPILE_DSN,\n    unipile_api_key: $env.UNIPILE_API_KEY\n  }\n}));"
      },
      "name": "Split Prospects",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [450, 300]
    },
    {
      "parameters": {
        "url": `={{$json.unipile_dsn}}/api/v1/users/{{$json.prospect.linkedin_url.split('/in/')[1].split('?')[0]}}`,
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "X-API-KEY",
              "value": "={{$json.unipile_api_key}}"
            }
          ]
        },
        "options": {}
      },
      "name": "Lookup LinkedIn Profile",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [650, 300]
    },
    {
      "parameters": {
        "url": "={{$json.unipile_dsn}}/api/v1/users/invite",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "X-API-KEY",
              "value": "={{$json.unipile_api_key}}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "attendee_id",
              "value": "={{$json.object.id}}"
            },
            {
              "name": "text",
              "value": "={{$json.messages.cr || $json.campaign.message_templates?.connection_request || 'Hi, I would like to connect!'}}"
            }
          ]
        },
        "options": {}
      },
      "name": "Send LinkedIn Invitation",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [850, 300]
    },
    {
      "parameters": {
        "functionCode": "// Extract message ID from Unipile response\nconst unipileResponse = $input.item.json;\nconst prospect = $input.item.json.prospect;\n\n// Try multiple locations for message ID\nconst messageId = \n  unipileResponse.object?.id ||\n  unipileResponse.id ||\n  unipileResponse.data?.id ||\n  unipileResponse.message_id ||\n  unipileResponse.invitation_id ||\n  `untracked_${Date.now()}_${prospect.id}`;\n\nconsole.log(`Message ID: ${messageId}`);\n\nreturn [{\n  json: {\n    prospect_id: prospect.id,\n    message_id: messageId,\n    status: 'connection_requested',\n    contacted_at: new Date().toISOString(),\n    unipile_response: unipileResponse\n  }\n}];"
      },
      "name": "Extract Message ID",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1050, 300]
    },
    {
      "parameters": {
        "url": `={{$env.NEXT_PUBLIC_SUPABASE_URL}}/rest/v1/campaign_prospects`,
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "={{$env.SUPABASE_SERVICE_ROLE_KEY}}"
            },
            {
              "name": "Authorization",
              "value": "Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Prefer",
              "value": "return=minimal"
            }
          ]
        },
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "id",
              "value": "eq.={{$json.prospect_id}}"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "status",
              "value": "={{$json.status}}"
            },
            {
              "name": "contacted_at",
              "value": "={{$json.contacted_at}}"
            },
            {
              "name": "personalization_data",
              "value": "={\"unipile_message_id\": \"{{$json.message_id}}\", \"unipile_response\": {{JSON.stringify($json.unipile_response)}}}"
            }
          ]
        },
        "options": {}
      },
      "name": "Update Prospect in Supabase",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [1250, 300]
    },
    {
      "parameters": {
        "functionCode": "console.log('✅ Prospect updated successfully');\nreturn $input.all();"
      },
      "name": "Success",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1450, 300]
    },
    {
      "parameters": {
        "functionCode": "const error = $input.item.json.error || $input.item.json;\nconsole.error('❌ Error processing prospect:', error);\n\n// Update prospect with error status\nreturn [{\n  json: {\n    prospect_id: $input.item.json.prospect?.id,\n    status: 'failed',\n    error: error.message || JSON.stringify(error)\n  }\n}];"
      },
      "name": "Error Handler",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1050, 500]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "Split Prospects", "type": "main", "index": 0 }]]
    },
    "Split Prospects": {
      "main": [[{ "node": "Lookup LinkedIn Profile", "type": "main", "index": 0 }]]
    },
    "Lookup LinkedIn Profile": {
      "main": [[{ "node": "Send LinkedIn Invitation", "type": "main", "index": 0 }]],
      "error": [[{ "node": "Error Handler", "type": "main", "index": 0 }]]
    },
    "Send LinkedIn Invitation": {
      "main": [[{ "node": "Extract Message ID", "type": "main", "index": 0 }]],
      "error": [[{ "node": "Error Handler", "type": "main", "index": 0 }]]
    },
    "Extract Message ID": {
      "main": [[{ "node": "Update Prospect in Supabase", "type": "main", "index": 0 }]]
    },
    "Update Prospect in Supabase": {
      "main": [[{ "node": "Success", "type": "main", "index": 0 }]],
      "error": [[{ "node": "Error Handler", "type": "main", "index": 0 }]]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  },
  "tags": []
};

async function getWorkflows() {
  console.log('📡 Fetching existing workflows...\n');

  try {
    const response = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch workflows: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error(`❌ Error: ${error.message}\n`);
    return [];
  }
}

async function createOrUpdateWorkflow() {
  const workflows = await getWorkflows();
  const existing = workflows.find(w => w.name === campaignWorkflow.name);

  console.log(`Found ${workflows.length} existing workflows\n`);

  if (existing) {
    console.log(`📝 Updating existing workflow: ${existing.name}`);
    console.log(`   ID: ${existing.id}\n`);

    try {
      const response = await fetch(`${N8N_API_URL}/api/v1/workflows/${existing.id}`, {
        method: 'PATCH',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...campaignWorkflow,
          id: existing.id
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Update failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Workflow updated successfully\n');
      return result;

    } catch (error) {
      console.error(`❌ Update error: ${error.message}\n`);
      return null;
    }

  } else {
    console.log('➕ Creating new workflow...\n');

    try {
      const response = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(campaignWorkflow)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Create failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Workflow created successfully\n');
      return result;

    } catch (error) {
      console.error(`❌ Create error: ${error.message}\n`);
      return null;
    }
  }
}

async function setEnvironmentVariables() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 Setting N8N Environment Variables');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const requiredVars = {
    UNIPILE_DSN,
    UNIPILE_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: SUPABASE_KEY
  };

  console.log('Required environment variables:');
  for (const [key, value] of Object.entries(requiredVars)) {
    const status = value ? '✅' : '❌';
    const displayValue = value ? `${value.substring(0, 30)}...` : 'NOT SET';
    console.log(`  ${status} ${key}: ${displayValue}`);
  }
  console.log('');
  console.log('⚠️  NOTE: These must be set in N8N UI manually:');
  console.log('   Settings → Environment Variables\n');
}

async function run() {
  console.log('Environment:');
  console.log(`  N8N URL: ${N8N_API_URL}`);
  console.log(`  API Key: ${N8N_API_KEY ? 'Set' : 'NOT SET'}`);
  console.log('');

  if (!N8N_API_KEY) {
    console.error('❌ N8N_API_KEY not set\n');
    return;
  }

  const result = await createOrUpdateWorkflow();

  if (result) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SUCCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Workflow ID: ${result.id}`);
    console.log(`Workflow Name: ${result.name}`);
    console.log(`Active: ${result.active}`);
    console.log(`Webhook URL: ${N8N_API_URL}/webhook/campaign-execute\n`);
  }

  await setEnvironmentVariables();
}

run().catch(console.error);
