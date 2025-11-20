#!/usr/bin/env node

import fs from 'fs';

const inputFile = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator (2).json';
const outputFile = '/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator - ALL-FIXED.json';

console.log('\n🔧 Fixing ALL double https:// issues in workflow...\n');

const workflow = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

let fixedCount = 0;

// Fix all HTTP Request nodes with URL issues
for (let node of workflow.nodes) {
  if (node.type === 'n8n-nodes-base.httpRequest' && node.parameters?.url) {
    const oldUrl = node.parameters.url;
    
    // Check if URL has 'https://' + prepended to UNIPILE_DSN
    if (oldUrl.includes("'https://' + $env.UNIPILE_DSN") || 
        oldUrl.includes('"https://" + $env.UNIPILE_DSN')) {
      
      // Remove the 'https://' + part
      const newUrl = oldUrl
        .replace("'https://' + $env.UNIPILE_DSN", "$env.UNIPILE_DSN")
        .replace('"https://" + $env.UNIPILE_DSN', '$env.UNIPILE_DSN');
      
      node.parameters.url = newUrl;
      
      console.log(`✅ Fixed: ${node.name}`);
      console.log(`   OLD: ${oldUrl.substring(0, 80)}...`);
      console.log(`   NEW: ${newUrl.substring(0, 80)}...\n`);
      
      fixedCount++;
    }
  }
}

// Also fix the database update node
const statusNode = workflow.nodes.find(n => n.name === 'Update Status - CR Sent');
if (statusNode) {
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
  console.log('✅ Fixed: Update Status - CR Sent (using Body Parameters)\n');
  fixedCount++;
}

fs.writeFileSync(outputFile, JSON.stringify(workflow, null, 2));

console.log(`\n✅ Fixed ${fixedCount} nodes total\n`);
console.log('Fixed workflow saved to:');
console.log(`   ${outputFile}\n`);
console.log('📋 Import this file to N8N and test again!\n');
