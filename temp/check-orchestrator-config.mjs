#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔍 SAM Master Campaign Orchestrator Configuration\n');

const response = await fetch(`${N8N_API_URL}/workflows/aVG6LC4ZFRMN7Bw6`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const wf = await response.json();

console.log('Workflow:', wf.name);
console.log('ID:', wf.id);
console.log('Active:', wf.active);
console.log('Nodes:', wf.nodes?.length);
console.log('');

console.log('Settings:');
console.log('  Timezone:', wf.settings?.timezone || 'not set');
console.log('  Execution Order:', wf.settings?.executionOrder || 'default');
console.log('');

const webhookNode = wf.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
if (webhookNode) {
  console.log('Webhook Configuration:');
  console.log('  Node Name:', webhookNode.name);
  console.log('  Path:', webhookNode.parameters.path);
  console.log('  HTTP Method:', webhookNode.parameters.httpMethod);
  console.log('  Response Mode:', webhookNode.parameters.responseMode || 'onReceived');
  console.log('  Response Data:', webhookNode.parameters.responseData || 'default');
  console.log('');

  // Check what webhook connects to
  const connections = wf.connections[webhookNode.name];
  if (connections?.main?.[0]) {
    console.log('  Connects to:', connections.main[0].map(c => c.node).join(', '));
  }
}

console.log('\nAll Nodes:');
wf.nodes.forEach((n, i) => {
  console.log(`  ${i + 1}. ${n.name} (${n.type})`);
});
