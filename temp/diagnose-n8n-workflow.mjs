#!/usr/bin/env node

/**
 * Diagnose N8N workflow issues
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'dsJ40aZYDOtSC1F7';

console.log('🔍 DIAGNOSING N8N WORKFLOW\n');

// Get workflow details
const response = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

if (!response.ok) {
  console.error('❌ Failed to fetch workflow:', await response.text());
  process.exit(1);
}

const workflow = await response.json();

console.log('📋 Workflow: ' + workflow.name);
console.log(`   ID: ${workflow.id}`);
console.log(`   Active: ${workflow.active ? '✅ YES' : '❌ NO'}`);
console.log(`   Nodes: ${workflow.nodes?.length || 0}`);
console.log('');

if (!workflow.active) {
  console.log('⚠️  PROBLEM: Workflow is INACTIVE');
  console.log('   Activating workflow...\n');

  const activateResponse = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}/activate`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY
    }
  });

  if (activateResponse.ok) {
    console.log('✅ Workflow activated!\n');
  } else {
    console.error('❌ Failed to activate:', await activateResponse.text());
  }
}

// Check webhook node configuration
const webhookNode = workflow.nodes?.find(n => n.type === 'n8n-nodes-base.webhook');

if (!webhookNode) {
  console.log('❌ PROBLEM: No webhook node found!');
  process.exit(1);
}

console.log('🔌 Webhook Configuration:');
console.log(`   Path: ${webhookNode.parameters.path}`);
console.log(`   Method: ${webhookNode.parameters.httpMethod}`);
console.log(`   Respond: ${webhookNode.parameters.responseMode || 'onReceived'}`);
console.log(`   Full URL: https://workflows.innovareai.com/webhook/${webhookNode.parameters.path}`);
console.log('');

// Check for required environment variables
console.log('🔧 Checking Required Environment Variables:\n');

const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'UNIPILE_DSN',
  'UNIPILE_API_KEY'
];

// We can't check N8N env vars via API, but we can test the webhook with data
console.log('   (N8N environment variables cannot be checked via API)');
console.log('   Testing webhook with sample data...\n');

// Send test webhook
const testPayload = {
  campaign_id: '4cd9275f-b82d-47d6-a1d4-7207b992c4b7',
  workspace_id: '04666209-fce8-4d71-8eaf-01278edfc73b',
  unipile_account_id: 'MT39bAEDTJ6e_ZPY337UgQ',
  campaign_type: 'connector',
  messages: {
    cr: 'Test message'
  },
  prospects: [{
    id: 'test-123',
    first_name: 'Test',
    last_name: 'User',
    linkedin_url: 'https://linkedin.com/in/test'
  }]
};

console.log('🧪 Sending test webhook...\n');

const webhookResponse = await fetch(`https://workflows.innovareai.com/webhook/${webhookNode.parameters.path}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testPayload)
});

console.log(`   Response: ${webhookResponse.status} ${webhookResponse.statusText}`);
const webhookResult = await webhookResponse.text();
console.log(`   Body: ${webhookResult}`);
console.log('');

// Wait and check for execution
console.log('⏳ Waiting 5 seconds for execution to appear...\n');
await new Promise(resolve => setTimeout(resolve, 5000));

// Check executions
const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
});

const execResult = await execResponse.json();
const executions = execResult.data || execResult;

if (executions.length > 0) {
  console.log('✅ Execution found!');
  console.log(`   Execution ID: ${executions[0].id}`);
  console.log(`   Status: ${executions[0].status || (executions[0].finished ? 'finished' : 'running')}`);
  console.log(`   Started: ${new Date(executions[0].startedAt).toLocaleString()}`);

  // Get execution details
  const detailResponse = await fetch(`${N8N_API_URL}/executions/${executions[0].id}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (detailResponse.ok) {
    const detail = await detailResponse.json();
    const runData = detail.data?.resultData?.runData || {};

    console.log('\n   📊 Node Execution Results:');
    Object.entries(runData).forEach(([nodeName, runs]) => {
      const lastRun = runs[runs.length - 1];
      if (lastRun.error) {
        console.log(`      ❌ ${nodeName}: ${lastRun.error.message}`);
      } else {
        console.log(`      ✅ ${nodeName}: Success`);
      }
    });

    if (detail.data?.resultData?.error) {
      console.log(`\n   ❌ Overall Error: ${detail.data.resultData.error.message}`);
    }
  }
} else {
  console.log('❌ NO EXECUTION FOUND');
  console.log('');
  console.log('🔍 Possible Issues:');
  console.log('   1. Workflow is set to "Production" mode (doesn\'t save executions)');
  console.log('   2. Webhook node uses "Respond Immediately" mode');
  console.log('   3. Workflow has an error that prevents execution');
  console.log('   4. N8N queue is backed up');
  console.log('');
  console.log('💡 Solution: Check N8N UI for workflow settings');
  console.log('   https://workflows.innovareai.com/workflow/' + WORKFLOW_ID + '/settings');
}

console.log('');
