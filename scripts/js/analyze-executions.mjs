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
  console.log('📊 N8N Execution Analysis\n');

  const executions = await httpsRequest(`/executions?workflowId=${WORKFLOW_ID}&limit=20`);

  console.log('Last 20 executions:');
  console.log('='.repeat(70));

  if (executions.data && executions.data.length > 0) {
    executions.data.forEach(exec => {
      const start = new Date(exec.startedAt);
      const stop = exec.stoppedAt ? new Date(exec.stoppedAt) : new Date();
      const duration = stop - start;
      const hasData = exec.data ? 'YES' : 'NO';
      const status = exec.status || 'running';

      console.log(`#${exec.id}: ${duration}ms, Data: ${hasData}, Status: ${status}, Finished: ${exec.finished}`);

      // If this execution has data, show what nodes ran
      if (exec.data && exec.data.resultData && exec.data.resultData.runData) {
        const nodes = Object.keys(exec.data.resultData.runData);
        console.log(`  └─ Nodes: ${nodes.join(', ')}`);
      }
    });
  } else {
    console.log('No executions found');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
