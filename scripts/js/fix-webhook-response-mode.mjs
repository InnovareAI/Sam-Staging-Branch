#!/usr/bin/env node
/**
 * FIX N8N WEBHOOK RESPONSE MODE BUG
 *
 * Problem: Webhook has responseMode: "lastNode" which responds immediately
 *          without executing the workflow (0.03s completions, no nodes run)
 *
 * Solution: Change to responseMode: "onReceived" to execute asynchronously
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA";
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

console.log('🔧 Fixing N8N webhook responseMode...\n');

// Fetch current workflow
const response = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

if (!response.ok) {
  console.error('❌ Failed to fetch workflow:', response.status);
  process.exit(1);
}

const workflow = await response.json();

// Find webhook node
const webhookNode = workflow.nodes?.find(n => n.type?.includes('webhook'));

if (!webhookNode) {
  console.error('❌ No webhook node found');
  process.exit(1);
}

console.log('Current webhook config:');
console.log('  Name:', webhookNode.name);
console.log('  Response Mode:', webhookNode.parameters?.responseMode);
console.log('  Path:', webhookNode.parameters?.path);

// Fix: Change responseMode from "lastNode" to "onReceived"
webhookNode.parameters.responseMode = "onReceived";

console.log('\n✅ Changing to: responseMode: "onReceived"');
console.log('   (This executes workflow asynchronously, doesn\'t wait for completion)\n');

// Clean workflow object - only include writable fields
const cleanWorkflow = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings,
  staticData: workflow.staticData
};

// Update workflow
const updateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': N8N_API_KEY
  },
  body: JSON.stringify(cleanWorkflow)
});

if (!updateResponse.ok) {
  console.error('❌ Failed to update workflow:', updateResponse.status);
  const errorText = await updateResponse.text();
  console.error('Error:', errorText);
  process.exit(1);
}

console.log('✅ WEBHOOK FIXED!\n');
console.log('📋 What changed:');
console.log('  BEFORE: responseMode: "lastNode"');
console.log('    → Webhook responded immediately (0.03s)');
console.log('    → No workflow execution created');
console.log('    → No nodes ran');
console.log('\n  AFTER: responseMode: "onReceived"');
console.log('    → Webhook responds HTTP 200 immediately');
console.log('    → Workflow executes asynchronously');
console.log('    → All nodes will run in background');
console.log('    → Execution visible in N8N');
console.log('\n🧪 Test now:');
console.log('   curl -X POST https://workflows.innovareai.com/webhook/campaign-execute \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"workspace_id":"test","campaign_id":"test","prospects":[]}\'');
console.log('\n   Then check executions in N8N UI or:');
console.log('   node scripts/js/check-n8n-execution-details.mjs [EXECUTION_ID]');
