#!/usr/bin/env node

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'MlOCPY7qzZ2nEuue';

const response = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json'
  }
});

const workflow = await response.json();

console.log('Workflow:', workflow.name);
console.log('Active:', workflow.active);
console.log('\nNode Connections:\n');

const webhookNode = workflow.nodes?.find(n => n.type === 'n8n-nodes-base.webhook');
console.log('1. Webhook node found:', webhookNode ? '✅' : '❌');

if (workflow.connections) {
  const connectionCount = Object.keys(workflow.connections).length;
  console.log(`\n${connectionCount} nodes have connections defined\n`);

  // Check if Webhook is connected
  const webhookConnections = workflow.connections['Webhook'];
  console.log('2. Webhook → connections:', webhookConnections ? '✅' : '❌');

  if (webhookConnections) {
    const firstConnection = webhookConnections.main?.[0]?.[0];
    if (firstConnection) {
      console.log(`   Connected to: "${firstConnection.node}"`);
    }
  } else {
    console.log('   ❌ WEBHOOK NOT CONNECTED TO ANY NODE!');
  }

  // Show all connections
  console.log('\nAll connections:');
  Object.entries(workflow.connections).forEach(([from, to]) => {
    const targets = to.main?.[0] || [];
    targets.forEach(target => {
      console.log(`  ${from} → ${target.node}`);
    });
  });
} else {
  console.log('❌ NO CONNECTIONS DEFINED!');
}
