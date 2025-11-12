#!/usr/bin/env node

/**
 * Examine N8N workflow structure
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔍 Examining N8N Campaign Execute workflow\n');

// Get workflow
const workflowResponse = await fetch(`${N8N_API_URL}/workflows/dsJ40aZYDOtSC1F7`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

const workflow = await workflowResponse.json();
const nodes = workflow.nodes || workflow.data?.nodes || [];

console.log(`Total nodes: ${nodes.length}\n`);
console.log('Node types and names:\n');

// Group by type
const nodesByType = {};
nodes.forEach(node => {
  if (!nodesByType[node.type]) {
    nodesByType[node.type] = [];
  }
  nodesByType[node.type].push(node.name);
});

Object.entries(nodesByType).forEach(([type, names]) => {
  console.log(`${type} (${names.length}):`);
  names.forEach(name => console.log(`  - ${name}`));
  console.log('');
});

// Find nodes that might update SAM
console.log('🔍 Looking for nodes that call SAM API:\n');

const potentialNodes = nodes.filter(node => {
  const params = JSON.stringify(node.parameters || {}).toLowerCase();
  return params.includes('meet-sam.com') ||
         params.includes('webhooks') ||
         params.includes('prospect') ||
         params.includes('status');
});

console.log(`Found ${potentialNodes.length} potential nodes:\n`);
potentialNodes.forEach(node => {
  console.log(`📌 ${node.name} (${node.type})`);
  console.log(`   Parameters:`, JSON.stringify(node.parameters, null, 2).substring(0, 500));
  console.log('');
});

// Save full workflow for inspection
writeFileSync(
  join(__dirname, 'workflow-campaign-execute.json'),
  JSON.stringify(workflow, null, 2)
);

console.log('✅ Full workflow saved to: temp/workflow-campaign-execute.json');
console.log('');
