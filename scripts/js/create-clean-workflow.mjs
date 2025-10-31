#!/usr/bin/env node
/**
 * Create a CLEAN working n8n workflow from scratch
 * Using modern Code node and proper connections
 */

import https from 'https';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const N8N_API_KEY = process.env.N8N_API_KEY;

function httpsRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'workflows.innovareai.com',
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('🚀 Creating Clean Working Workflow\n');

  const workflow = {
    name: 'SAM Campaign Execution v2 - Clean',
    nodes: [
      // 1. Webhook Node
      {
        name: 'Campaign Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        webhookId: 'campaign-execute-v2',
        parameters: {
          path: 'campaign-execute-v2',
          httpMethod: 'POST',
          responseMode: 'onReceived',
          options: {}
        }
      },

      // 2. Code Node (modern replacement for Function)
      {
        name: 'Extract Campaign Data',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [450, 300],
        parameters: {
          language: 'javaScript',
          jsCode: `// Extract webhook data
const webhookData = $input.first().json.body;

// Return formatted data
return {
  workspace_id: webhookData.workspaceId,
  campaign_id: webhookData.campaignId,
  unipile_account_id: webhookData.unipileAccountId,
  prospects: webhookData.prospects || [],
  messages: webhookData.messages || {},
  timing: webhookData.timing || {},
  supabase_url: webhookData.supabase_url,
  supabase_service_key: webhookData.supabase_service_key,
  unipile_dsn: webhookData.unipile_dsn,
  unipile_api_key: webhookData.unipile_api_key
};`
        }
      },

      // 3. Split In Batches (process prospects one at a time)
      {
        name: 'Process Each Prospect',
        type: 'n8n-nodes-base.splitInBatches',
        typeVersion: 3,
        position: [650, 300],
        parameters: {
          batchSize: 1,
          options: {
            reset: false
          }
        }
      },

      // 4. Code Node - Prepare Single Prospect
      {
        name: 'Prepare Prospect Data',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [850, 300],
        parameters: {
          language: 'javaScript',
          jsCode: `// Get the campaign data and current prospect
const campaignData = $input.first().json;
const prospect = campaignData.prospects[0]; // First prospect in batch

return {
  prospect_id: prospect.id,
  first_name: prospect.first_name,
  last_name: prospect.last_name,
  linkedin_url: prospect.linkedin_url,
  linkedin_user_id: prospect.linkedin_user_id,
  message: campaignData.messages.cr,
  unipile_account_id: campaignData.unipile_account_id,
  unipile_dsn: campaignData.unipile_dsn,
  unipile_api_key: campaignData.unipile_api_key
};`
        }
      },

      // 5. HTTP Request - Send LinkedIn Message (placeholder for now)
      {
        name: 'Send LinkedIn Message',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1050, 300],
        parameters: {
          method: 'POST',
          url: '={{ "https://" + $json.unipile_dsn + "/api/v1/messaging" }}',
          authentication: 'none',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              {
                name: 'X-API-KEY',
                value: '={{ $json.unipile_api_key }}'
              }
            ]
          },
          sendBody: true,
          contentType: 'json',
          body: `={
  "account_id": $json.unipile_account_id,
  "attendees": [$json.linkedin_user_id],
  "text": $json.message,
  "type": "LINKEDIN"
}`,
          options: {}
        }
      },

      // 6. Code Node - Log Success
      {
        name: 'Log Result',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1250, 300],
        parameters: {
          language: 'javaScript',
          jsCode: `console.log('Message sent to:', $input.first().json.first_name, $input.first().json.last_name);
return $input.all();`
        }
      }
    ],

    connections: {
      'Campaign Webhook': {
        main: [[{
          node: 'Extract Campaign Data',
          type: 'main',
          index: 0
        }]]
      },
      'Extract Campaign Data': {
        main: [[{
          node: 'Process Each Prospect',
          type: 'main',
          index: 0
        }]]
      },
      'Process Each Prospect': {
        main: [[{
          node: 'Prepare Prospect Data',
          type: 'main',
          index: 0
        }]]
      },
      'Prepare Prospect Data': {
        main: [[{
          node: 'Send LinkedIn Message',
          type: 'main',
          index: 0
        }]]
      },
      'Send LinkedIn Message': {
        main: [[{
          node: 'Log Result',
          type: 'main',
          index: 0
        }]]
      },
      'Log Result': {
        main: [[{
          node: 'Process Each Prospect',
          type: 'main',
          index: 0
        }]]
      }
    },

    settings: {
      executionOrder: 'v1',
      saveManualExecutions: true,
      saveExecutionProgress: true,
      saveDataSuccessExecution: 'all',
      saveDataErrorExecution: 'all',
      executionTimeout: 3600
    }
  };

  console.log('📤 Creating workflow...');
  const created = await httpsRequest('/workflows', 'POST', workflow);

  console.log('\n✅ WORKFLOW CREATED SUCCESSFULLY!\n');
  console.log('Name:', created.name);
  console.log('ID:', created.id);
  console.log('Nodes:', created.nodes.length);
  console.log('\n🔗 Webhook URL:');
  console.log('https://workflows.innovareai.com/webhook/campaign-execute-v2');
  console.log('\n📋 Next Steps:');
  console.log('1. Go to n8n UI and ACTIVATE the workflow');
  console.log('2. Test with the webhook URL above');
  console.log('\n✨ This workflow uses modern Code nodes and should work!');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
