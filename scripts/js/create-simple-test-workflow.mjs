#!/usr/bin/env node
/**
 * Create a minimal test workflow to verify n8n is working
 * Just webhook -> function -> done
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
  console.log('🧪 Creating Simple Test Workflow\n');

  const workflow = {
    name: 'Simple Test Workflow',
    nodes: [
      {
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        webhookId: 'test-webhook',
        parameters: {
          path: 'test-webhook',
          httpMethod: 'POST',
          responseMode: 'onReceived'
        }
      },
      {
        name: 'Function',
        type: 'n8n-nodes-base.function',
        typeVersion: 1,
        position: [450, 300],
        parameters: {
          functionCode: 'return [{ json: { message: "Test successful!", received: $input.all() } }];'
        }
      }
    ],
    connections: {
      'Webhook': {
        main: [[{
          node: 'Function',
          type: 'main',
          index: 0
        }]]
      }
    },
    settings: {
      saveExecutionProgress: true,
      saveDataSuccessExecution: 'all',
      saveDataErrorExecution: 'all'
    }
  };

  console.log('📤 Creating workflow...');
  const created = await httpsRequest('/workflows', 'POST', workflow);
  console.log('✅ Created:', created.name);
  console.log('ID:', created.id);
  console.log('\n🔗 Webhook URL:');
  console.log('https://workflows.innovareai.com/webhook/test-webhook');
  console.log('\n⚠️  IMPORTANT: Activate this workflow in the UI first!');
  console.log('Then test with:');
  console.log('curl -X POST https://workflows.innovareai.com/webhook/test-webhook -H "Content-Type: application/json" -d \'{"test": true}\'');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
