#!/usr/bin/env node

/**
 * Configure N8N via API to fix webhook signature issue
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const WEBHOOK_SECRET = 'a130520941cccec1ddbeb29cebb423088cf407ad142f3727279063336716b752';

console.log('🔧 Configuring N8N via API\n');
console.log(`N8N URL: ${N8N_API_URL}`);
console.log('');

// Step 1: Get all workflows
console.log('📋 Step 1: Finding Campaign Execute workflow...\n');

const workflowsResponse = await fetch(`${N8N_API_URL}/workflows`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

if (!workflowsResponse.ok) {
  console.error('❌ Failed to fetch workflows:', await workflowsResponse.text());
  process.exit(1);
}

const workflows = await workflowsResponse.json();
console.log(`Found ${workflows.data?.length || workflows.length || 0} workflows`);

// Find campaign execute workflow
const campaignWorkflow = (workflows.data || workflows).find(w =>
  w.name?.toLowerCase().includes('campaign') &&
  w.name?.toLowerCase().includes('execute')
);

if (!campaignWorkflow) {
  console.log('\nAvailable workflows:');
  (workflows.data || workflows).forEach(w => {
    console.log(`  - ${w.name} (${w.id})`);
  });
  console.error('\n❌ Could not find "Campaign Execute" workflow');
  process.exit(1);
}

console.log(`✅ Found: ${campaignWorkflow.name} (ID: ${campaignWorkflow.id})\n`);

// Step 2: Get workflow details
console.log('📋 Step 2: Getting workflow details...\n');

const workflowResponse = await fetch(`${N8N_API_URL}/workflows/${campaignWorkflow.id}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

if (!workflowResponse.ok) {
  console.error('❌ Failed to fetch workflow:', await workflowResponse.text());
  process.exit(1);
}

const workflow = await workflowResponse.json();
const nodes = workflow.nodes || workflow.data?.nodes || [];

console.log(`Workflow has ${nodes.length} nodes\n`);

// Step 3: Find HTTP Request nodes calling SAM API
console.log('📋 Step 3: Finding HTTP Request nodes calling SAM API...\n');

const httpNodes = nodes.filter(node => {
  if (node.type !== 'n8n-nodes-base.httpRequest') return false;

  const url = node.parameters?.url || '';
  return url.includes('app.meet-sam.com') || url.includes('webhooks/n8n');
});

console.log(`Found ${httpNodes.length} HTTP Request nodes calling SAM:\n`);
httpNodes.forEach(node => {
  console.log(`  - ${node.name}`);
  console.log(`    URL: ${node.parameters?.url}`);
});

if (httpNodes.length === 0) {
  console.log('\n⚠️  No HTTP nodes found calling SAM API');
  console.log('    Workflow may use different node structure');
  process.exit(0);
}

// Step 4: Update nodes with signature header
console.log('\n📋 Step 4: Adding signature header to HTTP nodes...\n');

let modified = false;

httpNodes.forEach(node => {
  // Get existing headers
  const headers = node.parameters?.headerParameters?.parameters || [];

  // Check if signature header already exists
  const hasSignature = headers.some(h => h.name === 'x-n8n-signature');

  if (hasSignature) {
    console.log(`  ✓ ${node.name} - already has signature header`);
  } else {
    console.log(`  + ${node.name} - adding signature header`);

    // Add signature header
    if (!node.parameters.headerParameters) {
      node.parameters.headerParameters = { parameters: [] };
    }

    node.parameters.headerParameters.parameters.push({
      name: 'x-n8n-signature',
      value: '={{ $crypto.hmac(JSON.stringify($json), "sha256", $env.N8N_WEBHOOK_SECRET, "hex") }}'
    });

    modified = true;
  }
});

if (!modified) {
  console.log('\n✅ All HTTP nodes already have signature headers');
  console.log('   No changes needed\n');
  process.exit(0);
}

// Step 5: Update workflow
console.log('\n📋 Step 5: Updating workflow...\n');

const updateResponse = await fetch(`${N8N_API_URL}/workflows/${campaignWorkflow.id}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: JSON.stringify(workflow)
});

if (!updateResponse.ok) {
  const errorText = await updateResponse.text();
  console.error('❌ Failed to update workflow:', errorText);
  process.exit(1);
}

const updated = await updateResponse.json();
console.log('✅ Workflow updated successfully\n');

// Step 6: Activate workflow if inactive
if (!workflow.active) {
  console.log('📋 Step 6: Activating workflow...\n');

  const activateResponse = await fetch(`${N8N_API_URL}/workflows/${campaignWorkflow.id}/activate`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (activateResponse.ok) {
    console.log('✅ Workflow activated\n');
  }
} else {
  console.log('✓ Workflow already active\n');
}

console.log('─'.repeat(60));
console.log('✅ N8N CONFIGURATION COMPLETE\n');
console.log('Next steps:');
console.log('1. Verify N8N environment variable N8N_WEBHOOK_SECRET is set');
console.log('2. Restart N8N if needed');
console.log('3. Run: node temp/retry-campaign.mjs');
console.log('');
