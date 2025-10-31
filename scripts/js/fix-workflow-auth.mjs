#!/usr/bin/env node
/**
 * Fix N8N Workflow Authentication
 * Remove generic credential type requirement and use manual headers from payload
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

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY not found');
  process.exit(1);
}

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
  console.log('🔧 Fixing N8N Workflow Authentication\n');

  // Get current workflow
  console.log('📥 Loading workflow...');
  const workflow = await httpsRequest(`/workflows/${WORKFLOW_ID}`);
  console.log(`   Found: ${workflow.name} (${workflow.nodes.length} nodes)\n`);

  // Find HTTP Request nodes with authentication issues
  const httpNodes = workflow.nodes.filter(n =>
    n.type === 'n8n-nodes-base.httpRequest' &&
    n.parameters?.authentication === 'genericCredentialType'
  );

  console.log(`🔍 Found ${httpNodes.length} HTTP nodes with authentication\n`);

  // Remove authentication requirement
  const fixedNodes = workflow.nodes.map(node => {
    if (node.type === 'n8n-nodes-base.httpRequest' &&
        node.parameters?.authentication === 'genericCredentialType') {

      console.log(`   Fixing: ${node.name}`);

      return {
        ...node,
        credentials: undefined, // Remove credential requirement
        parameters: {
          ...node.parameters,
          authentication: 'none', // Use no authentication
          // Headers will be passed via expressions from payload
        }
      };
    }
    return node;
  });

  // Update workflow - only send allowed fields
  const updatedWorkflow = {
    name: workflow.name,
    nodes: fixedNodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  console.log('\n💾 Saving updated workflow...');
  await httpsRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatedWorkflow);
  console.log('   ✅ Workflow updated\n');

  console.log('✅ AUTHENTICATION FIX COMPLETE\n');
  console.log('   Next step: Test workflow execution');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
