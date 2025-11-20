#!/usr/bin/env node

const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ';

const response = await fetch(`https://workflows.innovareai.com/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
  headers: { 'X-N8N-API-KEY': API_KEY }
});

const data = await response.json();
const execution = data.data[0];

console.log(`Latest execution: ${execution.id}`);
console.log(`Status: ${execution.status}\n`);

const detailResponse = await fetch(`https://workflows.innovareai.com/api/v1/executions/${execution.id}`, {
  headers: { 'X-N8N-API-KEY': API_KEY }
});

const details = await detailResponse.json();

// Check if Update Status node executed
if (details.data.resultData.runData['Update Status - CR Sent']) {
  console.log('✅ "Update Status - CR Sent" DID execute\n');
  const node = details.data.resultData.runData['Update Status - CR Sent'][0];

  console.log('Input data it received:');
  console.log(JSON.stringify(node.source?.[0]?.main?.[0]?.[0]?.json || 'No input data', null, 2));

  console.log('\nOutput/Response:');
  console.log(JSON.stringify(node.data?.main?.[0]?.[0]?.json || 'No output', null, 2));

  if (node.error) {
    console.log('\n❌ Error:', node.error);
  }
} else {
  console.log('❌ "Update Status - CR Sent" DID NOT execute\n');
}

// Check Send CR output
if (details.data.resultData.runData['Send CR']) {
  console.log('\n"Send CR" output (this becomes $json for next node):');
  const sendNode = details.data.resultData.runData['Send CR'][0];
  console.log(JSON.stringify(sendNode.data?.main?.[0]?.[0]?.json || 'No output', null, 2));
}

// Check Merge Profile Data output
if (details.data.resultData.runData['Merge Profile Data']) {
  console.log('\n"Merge Profile Data" output:');
  const mergeNode = details.data.resultData.runData['Merge Profile Data'][0];
  const output = mergeNode.data?.main?.[0]?.[0]?.json;
  console.log(`Has prospect.id: ${!!output?.prospect?.id}`);
  console.log(`Has campaignId: ${!!output?.campaignId}`);
  console.log(`prospect.id value: ${output?.prospect?.id}`);
  console.log(`campaignId value: ${output?.campaignId}`);
}
