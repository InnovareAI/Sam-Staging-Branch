#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔍 Checking Waiting N8N Executions\n');

const response = await fetch(`${N8N_API_URL}/executions?workflowId=aVG6LC4ZFRMN7Bw6&status=waiting&limit=20`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const result = await response.json();
const executions = result.data || result;

console.log(`Waiting Executions: ${executions.length}\n`);

executions.forEach((exec, i) => {
  console.log(`${i + 1}. Execution ID: ${exec.id}`);
  console.log(`   Status: ${exec.status}`);
  console.log(`   Started: ${new Date(exec.startedAt).toLocaleString()}`);
  console.log(`   Wait Till: ${exec.waitTill ? new Date(exec.waitTill).toLocaleString() : 'N/A'}`);
  console.log('');
});

console.log('='.repeat(60));
console.log('PROBLEM: Executions stuck in "Waiting" status');
console.log('='.repeat(60));
console.log('');
console.log('Cause: responseMode "lastNode" waits for ALL nodes to finish');
console.log('       But workflow has Wait nodes that run for hours/days');
console.log('       Webhook times out waiting for response\n');
console.log('Solution: Change webhook responseMode back to "onReceived"');
console.log('          OR add "Respond to Webhook" node after CR is sent\n');
