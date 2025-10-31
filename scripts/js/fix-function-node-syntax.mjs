#!/usr/bin/env node
/**
 * Fix campaign_handler Function node to use modern n8n syntax
 * Old: $input.item.json
 * New: $json (for single item) or $input.all() (for all items)
 */

import https from 'https';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

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
  console.log('🔧 Fixing Function Node Syntax\n');

  // Get workflow
  const workflow = await httpsRequest(`/workflows/${WORKFLOW_ID}`);
  console.log('📥 Loaded:', workflow.name);

  // Find campaign_handler
  const handlerNode = workflow.nodes.find(n => n.name === 'Campaign Handler');
  if (!handlerNode) {
    console.error('❌ Campaign Handler node not found!');
    process.exit(1);
  }

  console.log('\n📝 Updating function code...');
  console.log('   Old syntax: $input.item.json');
  console.log('   New syntax: $json');

  // Modern n8n syntax - $json for webhook data
  const newFunctionCode = `// Modern n8n syntax - $json contains webhook payload
const input = $json;

return {
  workspace_id: input.workspaceId || input.workspace_id,
  campaign_id: input.campaignId || input.campaign_id,
  unipile_account_id: input.unipileAccountId || input.unipile_account_id,
  prospects: input.prospects || [],
  messages: input.messages || {},
  timing: input.timing || {
    fu1_delay_days: 2,
    fu2_delay_days: 5,
    fu3_delay_days: 7,
    fu4_delay_days: 5,
    gb_delay_days: 7
  },
  supabase_url: input.supabase_url,
  supabase_service_key: input.supabase_service_key,
  unipile_dsn: input.unipile_dsn,
  unipile_api_key: input.unipile_api_key,
  last_message_sent: new Date().toISOString()
};`;

  // Update the node
  const updatedNode = {
    ...handlerNode,
    parameters: {
      ...handlerNode.parameters,
      functionCode: newFunctionCode
    }
  };

  // Update workflow
  const updatedWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes.map(n =>
      n.name === 'Campaign Handler' ? updatedNode : n
    ),
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  console.log('\n💾 Saving updated workflow...');
  await httpsRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatedWorkflow);
  console.log('   ✅ Saved\n');

  console.log('✅ FUNCTION SYNTAX FIXED');
  console.log('\n   The campaign_handler now uses modern n8n syntax.');
  console.log('   \n   ⚠️  You need to reactivate the workflow in the UI!');
  console.log('   1. Go to the workflow');
  console.log('   2. Toggle OFF then ON');
  console.log('   3. Test the webhook again');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
