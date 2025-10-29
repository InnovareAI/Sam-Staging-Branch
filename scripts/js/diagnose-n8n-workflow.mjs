#!/usr/bin/env node
import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

const response = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

if (!response.ok) {
  console.error('Failed to fetch workflow:', response.status);
  process.exit(1);
}

const workflow = await response.json();

console.log('\n🔍 N8N Workflow Diagnosis\n');
console.log('Name:', workflow.name);
console.log('ID:', workflow.id);
console.log('Active:', workflow.active);
console.log('\n📦 Nodes (' + (workflow.nodes?.length || 0) + '):');
workflow.nodes?.forEach(n => {
  console.log(`  • ${n.name} (${n.type})`);
});

console.log('\n🔗 Connections:');
if (workflow.connections) {
  Object.keys(workflow.connections).forEach(nodeName => {
    const conns = workflow.connections[nodeName];
    if (conns.main) {
      conns.main.forEach((outputConns, outputIndex) => {
        if (outputConns && outputConns.length > 0) {
          console.log(`  ${nodeName} [output ${outputIndex}]:`);
          outputConns.forEach(conn => {
            console.log(`    → ${conn.node}`);
          });
        }
      });
    }
  });
} else {
  console.log('  ❌ NO CONNECTIONS DEFINED');
}

// Check webhook node specifically
const webhookNode = workflow.nodes?.find(n => n.name === 'Campaign Execute Webhook');
if (webhookNode) {
  console.log('\n🌐 Webhook Configuration:');
  console.log('  Path:', webhookNode.parameters?.path);
  console.log('  Method:', webhookNode.parameters?.httpMethod);
  console.log('  Response Mode:', webhookNode.parameters?.responseMode);
}

// Check if webhook has connections
const webhookConns = workflow.connections?.['Campaign Execute Webhook'];
if (!webhookConns || !webhookConns.main?.[0] || webhookConns.main[0].length === 0) {
  console.log('\n❌ PROBLEM: Webhook has NO output connections!');
  console.log('   This is why workflow completes immediately (0.03s)');
  console.log('   Fix: Reconnect webhook to next node\n');
} else {
  console.log('\n✅ Webhook has connections');
}
