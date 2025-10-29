#!/usr/bin/env node
const N8N_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA';

const wfData = await fetch('https://workflows.innovareai.com/api/v1/workflows/aVG6LC4ZFRMN7Bw6', {
  headers: {'X-N8N-API-KEY': N8N_KEY}
}).then(r => r.json());

console.log('\n📊 Workflow Status\n');
console.log('Name:', wfData.name);
console.log('Active:', wfData.active);
console.log('Nodes:', wfData.nodes?.length || 0);
console.log('Connections:', Object.keys(wfData.connections || {}).length);

const webhook = wfData.nodes?.find(n => n.type?.includes('webhook'));
console.log('\n🌐 Webhook Node:');
console.log('  ID:', webhook?.id);
console.log('  Name:', webhook?.name);
console.log('  Response mode:', webhook?.parameters?.responseMode);
console.log('  Path:', webhook?.parameters?.path);

console.log('\n🔗 Connection Flow:');
let currentNode = 'webhook_trigger';
let visited = new Set();
let depth = 0;
while (currentNode && depth < 10 && !visited.has(currentNode)) {
  visited.add(currentNode);
  const connections = wfData.connections?.[currentNode];
  const nextNode = connections?.main?.[0]?.[0]?.node;
  console.log(`  ${currentNode} → ${nextNode || 'END'}`);
  currentNode = nextNode;
  depth++;
}

if (depth >= 10) {
  console.log('  ... (truncated)');
}

console.log('\n📋 Recent Executions:');
const execData = await fetch('https://workflows.innovareai.com/api/v1/executions?workflowId=aVG6LC4ZFRMN7Bw6&limit=3', {
  headers: {'X-N8N-API-KEY': N8N_KEY}
}).then(r => r.json());

if (execData.data?.length > 0) {
  for (const exec of execData.data) {
    const details = await fetch(`https://workflows.innovareai.com/api/v1/executions/${exec.id}`, {
      headers: {'X-N8N-API-KEY': N8N_KEY}
    }).then(r => r.json());

    const nodesRun = Object.keys(details.data?.resultData?.runData || {}).length;
    const duration = ((new Date(details.stoppedAt) - new Date(details.startedAt))/1000).toFixed(3);

    console.log(`  ${exec.id}: ${details.status} - ${nodesRun} nodes - ${duration}s`);
  }
} else {
  console.log('  No executions found');
}
