#!/usr/bin/env node
/**
 * Check current N8N workflow settings
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

async function makeN8NRequest(endpoint) {
  const response = await fetch(`${N8N_API_URL}${endpoint}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.json();
}

const workflow = await makeN8NRequest(`/workflows/${WORKFLOW_ID}`);

console.log('⚙️  Current Workflow Settings\n');
console.log('Name:', workflow.name);
console.log('ID:', workflow.id);
console.log('Active:', workflow.active);
console.log('\nSettings:');
console.log(JSON.stringify(workflow.settings, null, 2));

console.log('\n🔍 Critical Checks:');
console.log('  Execution Order:', workflow.settings?.executionOrder || 'NOT SET (defaults to v0)');
console.log('  Execution Timeout:', workflow.settings?.executionTimeout || 'NOT SET');
console.log('  Response Mode:', workflow.nodes?.find(n => n.type === 'n8n-nodes-base.webhook')?.parameters?.responseMode || 'NOT FOUND');

if (workflow.settings?.executionOrder !== 'v1') {
  console.log('\n❌ PROBLEM: Execution Order is NOT v1!');
  console.log('   This causes webhooks to exit immediately without processing.');
  console.log('   Solution: Must be set to "v1" in workflow settings.');
} else {
  console.log('\n✅ Execution Order is v1 (correct)');
}
