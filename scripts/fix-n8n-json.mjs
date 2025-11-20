#!/usr/bin/env node

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const inputFile = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator (2).json';
const outputFile = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - JSON-FIXED.json';

console.log('\n🔧 Fixing N8N JSON error...\n');

const workflow = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Find and fix the "Update Status - CR Sent" node
const statusNode = workflow.nodes.find(n => n.name === 'Update Status - CR Sent');

if (!statusNode) {
  console.error('❌ Could not find "Update Status - CR Sent" node');
  process.exit(1);
}

console.log('Found node at position:', statusNode.position);
console.log('\nOLD configuration:');
console.log(JSON.stringify(statusNode.parameters, null, 2));

// Fix the jsonBody - use JSON.stringify to ensure valid JSON
statusNode.parameters.jsonBody = '={{ JSON.stringify({ prospect_id: $json.prospect.id, campaign_id: $json.campaign_id, status: "connection_requested", contacted_at: $now.toISO() }) }}';

console.log('\nNEW configuration:');
console.log(JSON.stringify(statusNode.parameters, null, 2));

// Write fixed workflow
fs.writeFileSync(outputFile, JSON.stringify(workflow, null, 2));

console.log('\n✅ Fixed workflow saved to:');
console.log(`   ${outputFile}\n`);
console.log('📋 Next steps:');
console.log('1. Go to https://workflows.innovareai.com');
console.log('2. Import the fixed workflow file');
console.log('3. Activate it\n');
