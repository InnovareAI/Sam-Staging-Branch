#!/usr/bin/env node

// Test script to validate workflow data flow
const workflow = require('./SAM-Master-Campaign-Orchestrator-FIXED.json');

console.log('\n=== WORKFLOW VALIDATION ===\n');

// Check all Wait nodes
const waitNodes = workflow.nodes.filter(n => n.type === 'n8n-nodes-base.wait');
console.log(`Found ${waitNodes.length} Wait nodes:\n`);

waitNodes.forEach(node => {
  console.log(`- ${node.name}:`);
  console.log(`  Parameters:`, JSON.stringify(node.parameters, null, 2));

  if (!node.parameters.amount && node.parameters.amount !== 0) {
    console.log('  ⚠️  WARNING: No amount parameter!');
  }
  if (!node.parameters.unit) {
    console.log('  ⚠️  WARNING: No unit parameter!');
  }
  console.log('');
});

// Check Send CR node
const sendCRNode = workflow.nodes.find(n => n.name === 'Send CR');
console.log('\n=== SEND CR NODE ===\n');
console.log('URL:', sendCRNode.parameters.url);
console.log('Method:', sendCRNode.parameters.method);
console.log('Body type:', sendCRNode.parameters.specifyBody || 'bodyParameters');
console.log('');

if (sendCRNode.parameters.bodyParameters) {
  console.log('Body parameters:');
  sendCRNode.parameters.bodyParameters.parameters.forEach(param => {
    console.log(`  - ${param.name}: ${param.value}`);
  });
}

// Check Campaign Handler preserves send_delay_minutes
const handlerNode = workflow.nodes.find(n => n.name === 'Campaign Handler');
console.log('\n=== CAMPAIGN HANDLER ===\n');
const handlerCode = handlerNode.parameters.functionCode;
if (handlerCode.includes('send_delay_minutes')) {
  console.log('✅ Campaign Handler PRESERVES send_delay_minutes');
} else {
  console.log('❌ Campaign Handler DOES NOT preserve send_delay_minutes');
}

console.log('\n=== VALIDATION COMPLETE ===\n');
