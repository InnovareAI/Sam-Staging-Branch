#!/usr/bin/env node
import https from 'https';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

function httpsRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'workflows.innovareai.com',
      path: `/api/v1${path}`,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('🔗 Webhook Connection Verification\n');

  const workflow = await httpsRequest(`/workflows/${WORKFLOW_ID}`);

  const webhook = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
  console.log('Webhook node:');
  console.log('  ID:', webhook.id);
  console.log('  Name:', webhook.name);

  const webhookConnections = workflow.connections[webhook.id];
  console.log('\nConnections from webhook:');

  if (!webhookConnections || !webhookConnections.main || webhookConnections.main.length === 0) {
    console.log('  ❌ NO CONNECTIONS!');
    console.log('\n🚨 ROOT CAUSE FOUND:');
    console.log('  The webhook has NO outgoing connections.');
    console.log('  This is why all executions complete in 30ms with no data.');
    console.log('\n📝 Solution:');
    console.log('  The webhook needs to be connected to the first processing node');
    console.log('  in the n8n UI.');
    return;
  }

  console.log('  ✅ Has connections');
  const firstConnection = webhookConnections.main[0][0];
  console.log('\nFirst node after webhook:');
  console.log('  Target node ID:', firstConnection.node);
  console.log('  Connection type:', firstConnection.type);
  console.log('  Connection index:', firstConnection.index);

  // Verify target node exists
  const targetNode = workflow.nodes.find(n =>
    (n.id === firstConnection.node) || (n.name === firstConnection.node)
  );

  if (targetNode) {
    console.log('\nTarget node verification:');
    console.log('  ✅ Node exists');
    console.log('  Name:', targetNode.name);
    console.log('  Type:', targetNode.type);

    // Check if target node has connections too
    const targetConnections = workflow.connections[targetNode.id || targetNode.name];
    if (targetConnections && targetConnections.main && targetConnections.main[0]) {
      console.log('  ✅ Target node has outgoing connections');
      console.log('  Next node:', targetConnections.main[0][0].node);
    } else {
      console.log('  ⚠️  Target node has NO outgoing connections (dead end)');
    }
  } else {
    console.log('\n❌ TARGET NODE NOT FOUND!');
    console.log('\nThe webhook points to a node that doesn\'t exist in the workflow.');
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
