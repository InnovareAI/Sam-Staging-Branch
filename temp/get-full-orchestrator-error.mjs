#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔍 Getting Full Orchestrator Error Details\n');

// Get latest execution
const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=aVG6LC4ZFRMN7Bw6&limit=1`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const execResult = await execResponse.json();
const exec = (execResult.data || execResult)[0];

console.log(`Execution ID: ${exec.id}`);
console.log(`Status: ${exec.status}`);
console.log(`Duration: ${new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime()}ms\n`);

// Get full execution with all data
const detailResponse = await fetch(`${N8N_API_URL}/executions/${exec.id}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const detail = await detailResponse.json();

// Save to file
writeFileSync(join(__dirname, 'orchestrator-exec-full.json'), JSON.stringify(detail, null, 2));
console.log('Saved full execution to: temp/orchestrator-exec-full.json\n');

// Analyze
console.log('='.repeat(60));
console.log('EXECUTION ANALYSIS:');
console.log('='.repeat(60));
console.log('');

if (detail.data) {
  console.log('Has data:', !!detail.data);
  console.log('Has resultData:', !!detail.data.resultData);
  console.log('Has runData:', !!detail.data.resultData?.runData);

  const runData = detail.data.resultData?.runData || {};
  console.log('Nodes executed:', Object.keys(runData).length);

  if (Object.keys(runData).length > 0) {
    console.log('\nNodes:');
    for (const [nodeName, runs] of Object.entries(runData)) {
      console.log(`  - ${nodeName}: ${runs.length} runs`);
      if (runs[0]?.error) {
        console.log(`    ERROR: ${runs[0].error.message}`);
      }
    }
  } else {
    console.log('\n⚠️  NO NODES EXECUTED');
    console.log('This means the workflow crashed before any node could run.');
    console.log('');
    console.log('Possible causes:');
    console.log('- Missing environment variables in N8N');
    console.log('- Workflow configuration error');
    console.log('- Invalid webhook payload structure');
    console.log('- First node (webhook or trigger) is misconfigured');
  }

  if (detail.data.resultData?.error) {
    console.log('\n❌ WORKFLOW ERROR:');
    console.log(JSON.stringify(detail.data.resultData.error, null, 2));
  }
} else {
  console.log('❌ No execution data available');
}

console.log('');
