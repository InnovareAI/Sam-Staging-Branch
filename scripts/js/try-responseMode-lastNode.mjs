#!/usr/bin/env node
/**
 * Try changing responseMode to "lastNode" instead of "onReceived"
 * Maybe onReceived has a bug in this n8n version
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
  console.log('🔧 Trying responseMode: "lastNode"\n');

  const workflow = await httpsRequest(`/workflows/${WORKFLOW_ID}`);
  console.log('📥 Loaded:', workflow.name);

  const webhook = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');

  console.log('\nCurrent responseMode:', webhook.parameters.responseMode);
  console.log('Changing to: "lastNode"');

  const updatedWebhook = {
    ...webhook,
    parameters: {
      ...webhook.parameters,
      responseMode: 'lastNode'
    }
  };

  const updatedWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes.map(n =>
      n.type === 'n8n-nodes-base.webhook' ? updatedWebhook : n
    ),
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  console.log('\n💾 Saving...');
  await httpsRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatedWorkflow);
  console.log('   ✅ Saved\n');

  console.log('✅ RESPONSE MODE CHANGED');
  console.log('\n   ⚠️  Reactivate the workflow and test again!');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
