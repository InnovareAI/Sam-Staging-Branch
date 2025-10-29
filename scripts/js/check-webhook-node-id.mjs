#!/usr/bin/env node
/**
 * Check webhook node ID and connections
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

console.log('🔍 Webhook Node Analysis\n');

// Find all webhook nodes
const webhookNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.webhook');
console.log(`Found ${webhookNodes.length} webhook node(s):\n`);

webhookNodes.forEach(node => {
  console.log(`  ID: ${node.id}`);
  console.log(`  Name: ${node.name}`);
  console.log(`  Path: ${node.parameters?.path}`);
  console.log(`  Response Mode: ${node.parameters?.responseMode}`);
  console.log(`  Webhook ID: ${node.webhookId}`);

  // Check if this node has outgoing connections
  const conns = workflow.connections?.[node.id] || workflow.connections?.[node.name];
  console.log(`  Connections (by ID): ${JSON.stringify(workflow.connections?.[node.id])}`);
  console.log(`  Connections (by name): ${JSON.stringify(workflow.connections?.[node.name])}`);
  console.log('');
});

console.log('\n📋 All Connection Keys:');
console.log(Object.keys(workflow.connections || {}).join(', '));

console.log('\n🎯 Issue Check:');
const webhookNode = webhookNodes[0];
if (webhookNode) {
  const hasConnById = workflow.connections?.[webhookNode.id];
  const hasConnByName = workflow.connections?.[webhookNode.name];

  if (!hasConnById && !hasConnByName) {
    console.log('❌ Webhook node has NO outgoing connections - this is the problem!');
    console.log('   The webhook triggers but has nowhere to send data.');
  } else {
    console.log('✅ Webhook node has connections');
    const connKey = hasConnById ? webhookNode.id : webhookNode.name;
    const targetNode = workflow.connections[connKey]?.main?.[0]?.[0]?.node;
    console.log(`   Connected to: ${targetNode}`);
  }
}
