#!/usr/bin/env node

import fs from 'fs';

const inputFile = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator (2).json';
const outputFile = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - PARAMS-FIXED.json';

console.log('\n🔧 Fixing N8N using Body Parameters...\n');

const workflow = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Find the node
const statusNode = workflow.nodes.find(n => n.name === 'Update Status - CR Sent');

if (!statusNode) {
  console.error('❌ Node not found');
  process.exit(1);
}

console.log('OLD parameters:');
console.log(JSON.stringify(statusNode.parameters, null, 2));

// Change from jsonBody to bodyParameters
statusNode.parameters = {
  "method": "POST",
  "url": "https://app.meet-sam.com/api/webhooks/n8n/prospect-status",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyParameters": {
    "parameters": [
      {
        "name": "prospect_id",
        "value": "={{ $json.prospect.id }}"
      },
      {
        "name": "campaign_id",
        "value": "={{ $json.campaign_id }}"
      },
      {
        "name": "status",
        "value": "connection_requested"
      },
      {
        "name": "contacted_at",
        "value": "={{ $now.toISO() }}"
      }
    ]
  },
  "options": {}
};

// Remove specifyBody and jsonBody
delete statusNode.parameters.specifyBody;
delete statusNode.parameters.jsonBody;

console.log('\nNEW parameters:');
console.log(JSON.stringify(statusNode.parameters, null, 2));

fs.writeFileSync(outputFile, JSON.stringify(workflow, null, 2));

console.log('\n✅ Fixed workflow saved to:');
console.log(`   ${outputFile}\n`);
console.log('Import this file to N8N and test again!\n');
