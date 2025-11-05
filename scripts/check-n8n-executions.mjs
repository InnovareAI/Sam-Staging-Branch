#!/usr/bin/env node

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'MlOCPY7qzZ2nEuue';

console.log('🔍 Checking recent executions for enrichment workflow...\n');

const response = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=5`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
const executions = result.data || [];

if (executions.length === 0) {
  console.log('No executions found for this workflow');
} else {
  console.log(`Found ${executions.length} recent executions:\n`);

  executions.forEach((exec, i) => {
    console.log(`${i + 1}. Execution ${exec.id}`);
    console.log(`   Status: ${exec.status}`);
    console.log(`   Started: ${new Date(exec.startedAt).toLocaleString()}`);
    if (exec.stoppedAt) {
      console.log(`   Stopped: ${new Date(exec.stoppedAt).toLocaleString()}`);
    }
    console.log(`   Mode: ${exec.mode}`);

    if (exec.status === 'error') {
      console.log(`   ❌ Error detected`);
    } else if (exec.status === 'success') {
      console.log(`   ✅ Success`);
    }
    console.log();
  });

  // Get details of most recent execution
  const latest = executions[0];
  console.log(`\n📋 Latest execution details:`);
  console.log(`   ID: ${latest.id}`);
  console.log(`   Status: ${latest.status}`);
  console.log(`   View at: https://workflows.innovareai.com/execution/${latest.id}`);
}
