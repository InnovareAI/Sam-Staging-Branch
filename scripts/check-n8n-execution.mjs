#!/usr/bin/env node

const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ';

// Get latest execution
const response = await fetch(`https://workflows.innovareai.com/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
  headers: {
    'X-N8N-API-KEY': API_KEY
  }
});

const data = await response.json();
const execution = data.data[0];

console.log('Latest execution:');
console.log(`  ID: ${execution.id}`);
console.log(`  Status: ${execution.status}`);
console.log(`  Started: ${execution.startedAt}`);
console.log(`  Stopped: ${execution.stoppedAt || 'still running'}`);
console.log(`  Mode: ${execution.mode}`);

// Get full execution details
const detailResponse = await fetch(`https://workflows.innovareai.com/api/v1/executions/${execution.id}`, {
  headers: {
    'X-N8N-API-KEY': API_KEY
  }
});

const details = await detailResponse.json();

// Check which nodes executed
console.log('\nNode execution status:');
for (const [nodeName, nodeData] of Object.entries(details.data.resultData.runData || {})) {
  console.log(`  ${nodeName}:`);
  for (const run of nodeData) {
    console.log(`    - startTime: ${run.startTime}`);
    console.log(`    - executionTime: ${run.executionTime}ms`);
    console.log(`    - error: ${run.error ? JSON.stringify(run.error) : 'none'}`);
    console.log(`    - data: ${run.data?.main?.[0]?.length || 0} items`);
  }
}

// Specifically check if "Update Status - CR Sent" executed
if (details.data.resultData.runData['Update Status - CR Sent']) {
  console.log('\n✅ "Update Status - CR Sent" node DID execute');
  const updateNode = details.data.resultData.runData['Update Status - CR Sent'][0];
  console.log(`Response data:`, JSON.stringify(updateNode.data, null, 2));
} else {
  console.log('\n❌ "Update Status - CR Sent" node DID NOT execute');
}

// Check if "Send CR" executed and what happened
if (details.data.resultData.runData['Send CR']) {
  console.log('\n"Send CR" node execution:');
  const sendNode = details.data.resultData.runData['Send CR'][0];
  console.log(`  Error: ${sendNode.error ? JSON.stringify(sendNode.error, null, 2) : 'none'}`);
  console.log(`  Data items: ${sendNode.data?.main?.[0]?.length || 0}`);
  if (sendNode.data?.main?.[0]?.[0]) {
    console.log(`  Output data:`, JSON.stringify(sendNode.data.main[0][0].json, null, 2));
  }
}
