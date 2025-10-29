#!/usr/bin/env node
/**
 * Get FULL execution data including all node outputs
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const executionId = process.argv[2] || '58971';

async function makeN8NRequest(endpoint) {
  const response = await fetch(`${N8N_API_URL}${endpoint}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.json();
}

console.log(`\n📊 FULL Execution Data #${executionId}\n`);

const exec = await makeN8NRequest(`/executions/${executionId}`);

console.log('Status:', exec.status);
console.log('Mode:', exec.mode);
console.log('Started:', new Date(exec.startedAt).toLocaleString());
console.log('Stopped:', new Date(exec.stoppedAt).toLocaleString());
console.log('Duration:', ((new Date(exec.stoppedAt) - new Date(exec.startedAt)) / 1000).toFixed(3) + 's');

console.log('\n🔍 Execution Data:');
console.log(JSON.stringify(exec.data, null, 2));

console.log('\n📦 Run Data Keys:');
if (exec.data?.resultData?.runData) {
  console.log(Object.keys(exec.data.resultData.runData));
} else {
  console.log('❌ NO RUN DATA');
}

console.log('\n🚨 Error:');
console.log(exec.data?.resultData?.error || 'No error');

console.log('\n📝 Last Node Data:');
console.log(JSON.stringify(exec.data?.resultData?.lastNodeExecuted, null, 2));
