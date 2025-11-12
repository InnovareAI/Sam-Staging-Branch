#!/usr/bin/env node

/**
 * Get detailed execution data to see what's actually happening
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'dsJ40aZYDOtSC1F7';

console.log('🔍 Getting Latest Execution Details\n');

// Get latest execution
const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

const execResult = await execResponse.json();
const executions = execResult.data || execResult;

if (executions.length === 0) {
  console.log('❌ No executions found');
  process.exit(1);
}

const latestExec = executions[0];
console.log(`Latest Execution: ${latestExec.id}`);
console.log(`Status: ${latestExec.status}`);
console.log(`Started: ${new Date(latestExec.startedAt).toLocaleString()}`);
console.log('');

// Get full execution details
const detailResponse = await fetch(`${N8N_API_URL}/executions/${latestExec.id}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

if (!detailResponse.ok) {
  console.error('❌ Failed to get details:', await detailResponse.text());
  process.exit(1);
}

const detail = await detailResponse.json();

// Save full execution for inspection
writeFileSync(
  join(__dirname, 'latest-execution.json'),
  JSON.stringify(detail, null, 2)
);

console.log('✅ Full execution saved to: temp/latest-execution.json\n');

// Analyze the execution
const runData = detail.data?.resultData?.runData || {};

console.log('📊 Nodes Executed:\n');

for (const [nodeName, runs] of Object.entries(runData)) {
  const lastRun = runs[runs.length - 1];
  const hasData = lastRun.data?.main?.[0]?.length > 0;
  const itemCount = lastRun.data?.main?.[0]?.length || 0;

  if (lastRun.error) {
    console.log(`❌ ${nodeName}`);
    console.log(`   Error: ${lastRun.error.message}`);
    if (lastRun.error.description) {
      console.log(`   Details: ${lastRun.error.description}`);
    }
  } else {
    console.log(`✅ ${nodeName}`);
    console.log(`   Items: ${itemCount}`);

    // Show first item data preview for important nodes
    if (itemCount > 0 && (
      nodeName.includes('Split') ||
      nodeName.includes('Extract') ||
      nodeName.includes('Send')
    )) {
      const firstItem = lastRun.data.main[0][0];
      console.log(`   Data preview:`, JSON.stringify(firstItem.json, null, 2).substring(0, 200) + '...');
    }
  }
  console.log('');
}

// Check if any Unipile calls were made
const sendNodes = Object.keys(runData).filter(name => name.includes('Send'));
console.log(`\n📤 Send Nodes: ${sendNodes.length}`);
sendNodes.forEach(name => {
  console.log(`   - ${name}`);
});

// Check if any status updates were made
const updateNodes = Object.keys(runData).filter(name => name.includes('Update'));
console.log(`\n📝 Update Nodes: ${updateNodes.length}`);
updateNodes.forEach(name => {
  console.log(`   - ${name}`);
});

console.log('\n');
