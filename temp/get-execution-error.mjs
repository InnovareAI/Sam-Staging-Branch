#!/usr/bin/env node

/**
 * Get the actual error from failed N8N executions
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'dsJ40aZYDOtSC1F7';

console.log('🔍 Getting Error Details from Failed Executions\n');

// Get recent executions
const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=20`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

const execResult = await execResponse.json();
const allExecutions = execResult.data || execResult;

// Filter for error status
const executions = allExecutions.filter(e => e.status === 'error' || e.status === 'crashed');

if (executions.length === 0) {
  console.log('❌ No failed executions found');
  console.log(`\nAll ${allExecutions.length} executions:`);
  allExecutions.forEach(e => {
    console.log(`   ${e.id}: ${e.status} - ${new Date(e.startedAt).toLocaleString()}`);
  });
  process.exit(0);
}

console.log(`Found ${executions.length} failed executions (out of ${allExecutions.length} total)\n`);

// Get details of the most recent failure
const latestFailed = executions[0];
console.log(`Latest Failed Execution: ${latestFailed.id}`);
console.log(`Time: ${new Date(latestFailed.startedAt).toLocaleString()}`);
console.log('');

const detailResponse = await fetch(`${N8N_API_URL}/executions/${latestFailed.id}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

if (!detailResponse.ok) {
  console.error('❌ Failed to get details');
  process.exit(1);
}

const detail = await detailResponse.json();

console.log('━'.repeat(60));
console.log('ERROR DETAILS:');
console.log('━'.repeat(60));
console.log('');

// Check for overall error
if (detail.data?.resultData?.error) {
  const error = detail.data.resultData.error;
  console.log('❌ WORKFLOW ERROR:');
  console.log(`   Message: ${error.message}`);
  if (error.description) {
    console.log(`   Description: ${error.description}`);
  }
  if (error.stack) {
    console.log(`   Stack: ${error.stack.substring(0, 500)}`);
  }
  console.log('');
}

// Check individual node errors
const runData = detail.data?.resultData?.runData || {};

for (const [nodeName, runs] of Object.entries(runData)) {
  const lastRun = runs[runs.length - 1];

  if (lastRun?.error) {
    console.log(`❌ NODE: ${nodeName}`);
    console.log(`   Error: ${lastRun.error.message}`);

    if (lastRun.error.description) {
      console.log(`   Description: ${lastRun.error.description}`);
    }

    if (lastRun.error.context) {
      console.log(`   Context:`, JSON.stringify(lastRun.error.context, null, 2));
    }

    if (lastRun.error.httpCode) {
      console.log(`   HTTP Code: ${lastRun.error.httpCode}`);
    }

    console.log('');
  }
}

// Check the webhook input data
const webhookData = runData['Webhook']?.[0]?.data?.main?.[0]?.[0];
if (webhookData) {
  console.log('📥 WEBHOOK INPUT DATA:');
  console.log(JSON.stringify(webhookData.json, null, 2).substring(0, 500) + '...');
  console.log('');
}

console.log('━'.repeat(60));
console.log('');
