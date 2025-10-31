#!/usr/bin/env node
/**
 * Fix broken Switch nodes in N8N workflow
 * Connect webhook directly to campaign_handler, bypassing broken routers
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
  console.log('🔧 Fixing broken Switch nodes\n');

  // Get workflow
  console.log('📥 Loading workflow...');
  const workflow = await httpsRequest(`/workflows/${WORKFLOW_ID}`);
  console.log(`   ${workflow.name}\n`);

  // Update connections: webhook -> campaign_handler (skip broken switches)
  console.log('🔗 Updating connections...');
  console.log('   webhook_trigger -> campaign_handler (bypassing switches)');

  const updatedConnections = {
    ...workflow.connections,
    'webhook_trigger': {
      main: [[{
        node: 'campaign_handler',
        type: 'main',
        index: 0
      }]]
    }
  };

  // Remove the broken switch nodes from the workflow
  const filteredNodes = workflow.nodes.filter(n =>
    n.name !== 'Workspace Router' && n.name !== 'Template Selector'
  );

  console.log('   Removed broken Switch nodes');
  console.log(`   Nodes: ${workflow.nodes.length} -> ${filteredNodes.length}\n`);

  // Update workflow
  const updatedWorkflow = {
    name: workflow.name,
    nodes: filteredNodes,
    connections: updatedConnections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  console.log('💾 Saving...');
  await httpsRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatedWorkflow);
  console.log('   ✅ Saved\n');

  console.log('✅ SWITCH NODES FIXED');
  console.log('\n   Webhook now connects directly to Campaign Handler');
  console.log('   Workflow should execute properly now');
  console.log('\n   ⚠️  You need to reactivate the workflow in the UI!');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
