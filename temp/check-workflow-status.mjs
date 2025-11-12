#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔍 Checking Workflow Status\n');

const response = await fetch(`${N8N_API_URL}/workflows/aVG6LC4ZFRMN7Bw6`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const workflow = await response.json();

console.log('Workflow:', workflow.name);
console.log('ID:', workflow.id);
console.log('Active:', workflow.active);
console.log('');

// Check webhook node
const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
console.log('Webhook Node:');
console.log('  Response Mode:', webhookNode.parameters.responseMode || 'NOT SET (defaults to onReceived)');
console.log('  Response Data:', webhookNode.parameters.responseData || 'NOT SET');
console.log('  Path:', webhookNode.parameters.path);
console.log('');

// Get recent executions
const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=aVG6LC4ZFRMN7Bw6&limit=3`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const execResult = await execResponse.json();
const executions = execResult.data || execResult;

console.log('Recent Executions:');
executions.forEach((exec, i) => {
  console.log(`  ${i + 1}. ID: ${exec.id}, Status: ${exec.status}, Duration: ${new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime()}ms`);
});
