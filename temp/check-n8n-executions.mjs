#!/usr/bin/env node

/**
 * Check N8N workflow executions for errors
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'dsJ40aZYDOtSC1F7'; // Campaign Execute workflow

console.log('🔍 Checking N8N Workflow Executions\n');

// Get recent executions
const response = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=10`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

if (!response.ok) {
  console.error('❌ Failed to fetch executions:', await response.text());
  process.exit(1);
}

const result = await response.json();
const executions = result.data || result;

console.log(`Found ${executions.length} recent executions:\n`);

for (const exec of executions.slice(0, 5)) {
  const status = exec.finished ? (exec.stoppedAt ? '✅ Success' : '⚠️ Running') : '❌ Failed';
  const statusIcon = exec.finished && !exec.stoppedAt ? '⚠️' : exec.finished ? '✅' : '❌';

  console.log(`${statusIcon} Execution ${exec.id}`);
  console.log(`   Status: ${exec.status || (exec.finished ? 'finished' : 'running')}`);
  console.log(`   Started: ${new Date(exec.startedAt).toLocaleString()}`);

  if (exec.stoppedAt) {
    console.log(`   Stopped: ${new Date(exec.stoppedAt).toLocaleString()}`);
  }

  // Get full execution details to see errors
  const detailResponse = await fetch(`${N8N_API_URL}/executions/${exec.id}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (detailResponse.ok) {
    const detail = await detailResponse.json();
    const execData = detail.data || detail;

    // Check for errors
    if (execData.data?.resultData?.error) {
      console.log(`   ❌ ERROR: ${execData.data.resultData.error.message}`);
    }

    // Check individual nodes for errors
    const runData = execData.data?.resultData?.runData || {};
    let hasErrors = false;

    for (const [nodeName, nodeRuns] of Object.entries(runData)) {
      const lastRun = nodeRuns[nodeRuns.length - 1];

      if (lastRun?.error) {
        console.log(`   ❌ Node "${nodeName}": ${lastRun.error.message}`);
        hasErrors = true;
      }
    }

    if (!hasErrors && !execData.data?.resultData?.error) {
      console.log(`   ✅ No errors found`);
    }
  }

  console.log('');
}

console.log('─'.repeat(60));
console.log('\n💡 To view full execution details, go to:');
console.log(`   https://workflows.innovareai.com/workflow/${WORKFLOW_ID}/executions\n`);
