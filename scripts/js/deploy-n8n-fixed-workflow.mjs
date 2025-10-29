#!/usr/bin/env node
/**
 * Deploy N8N GPT's Fixed Workflow
 * - Includes expression: true flags
 * - Has loop logic with If node
 * - Sends CRs to ALL prospects
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

async function makeN8NRequest(endpoint, method = 'GET', body = null) {
  const response = await fetch(`${N8N_API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`N8N API error ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

console.log('📤 Deploying N8N GPT Fixed Workflow...\n');

// Read the workflow JSON
const workflowPath = join(__dirname, 'n8n-fixed-workflow.json');
const workflowData = JSON.parse(readFileSync(workflowPath, 'utf-8'));

// Extract only what N8N needs for update (active is read-only)
const payload = {
  name: workflowData.name,
  nodes: workflowData.nodes,
  connections: workflowData.connections,
  settings: workflowData.settings
};

console.log('📋 Workflow details:');
console.log(`   Name: ${payload.name}`);
console.log(`   Nodes: ${payload.nodes.length}`);
console.log(`   Active: ${payload.active}\n`);

console.log('🔧 Key fixes included:');
console.log('   ✅ expression: true on all dynamic fields');
console.log('   ✅ Loop logic with If node');
console.log('   ✅ Checks splitInBatches.hasNext');
console.log('   ✅ Sends to ALL prospects\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', payload);
  console.log('✅ N8N FIXED WORKFLOW DEPLOYED!\n');
  console.log('📋 Flow:');
  console.log('   Webhook → Handler → Prepare → Split → Send CR → Log → Check Loop → (loop or end)\n');
  console.log('🎯 Test with:');
  console.log('   node scripts/js/test-webhook-direct.mjs\n');
  console.log('Expected: Should send CRs to ALL prospects in payload\n');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
