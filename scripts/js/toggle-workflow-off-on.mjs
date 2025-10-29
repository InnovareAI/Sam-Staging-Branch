#!/usr/bin/env node
import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

async function makeN8NRequest(endpoint, method = 'GET') {
  const response = await fetch(`${N8N_API_URL}${endpoint}`, {
    method,
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return await response.json();
}

console.log('🔄 Toggling workflow OFF...');
await makeN8NRequest(`/workflows/${WORKFLOW_ID}/deactivate`, 'POST');
console.log('✅ Workflow deactivated');

console.log('\n⏳ Waiting 2 seconds...');
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('\n🔄 Toggling workflow ON...');
const result = await makeN8NRequest(`/workflows/${WORKFLOW_ID}/activate`, 'POST');
console.log('✅ Workflow activated');
console.log(`   Active: ${result.active}`);
console.log(`   Execution Order: ${result.settings?.executionOrder || 'N/A'}`);
console.log('\n✅ Done! Now test the webhook.\n');
