#!/usr/bin/env node
/**
 * Test the manually-created n8n Campaign Execution v3 workflow
 *
 * This script tests the workflow created manually in the n8n UI
 * (not via API, as API-deployed workflows don't work properly)
 */

import https from 'https';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const WEBHOOK_URL = 'https://workflows.innovareai.com/webhook/campaign-execute-v3';
const N8N_API_KEY = process.env.N8N_API_KEY;

// Test payload with 2 prospects
const testPayload = {
  workspaceId: 'test-workspace-' + Date.now(),
  campaignId: 'test-campaign-' + Date.now(),
  unipileAccountId: process.env.UNIPILE_ACCOUNT_ID || 'test-account',
  prospects: [
    {
      id: 'prospect-1-' + Date.now(),
      first_name: 'John',
      last_name: 'Doe',
      linkedin_url: 'https://linkedin.com/in/johndoe',
      linkedin_user_id: 'linkedin-user-1'
    },
    {
      id: 'prospect-2-' + Date.now(),
      first_name: 'Jane',
      last_name: 'Smith',
      linkedin_url: 'https://linkedin.com/in/janesmith',
      linkedin_user_id: 'linkedin-user-2'
    }
  ],
  messages: {
    cr: 'Hi {{first_name}}, I would love to connect with you!'
  },
  timing: {
    delay_between_messages: 5000
  },
  supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  unipile_dsn: process.env.UNIPILE_DSN,
  unipile_api_key: process.env.UNIPILE_API_KEY
};

function sendWebhook(url, payload) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(payload);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function n8nApiRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'workflows.innovareai.com',
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function findWorkflowByName(name) {
  const workflows = await n8nApiRequest('/workflows');
  return workflows.data.find(w => w.name === name);
}

async function getLatestExecution(workflowId) {
  const executions = await n8nApiRequest(`/executions?workflowId=${workflowId}&limit=1`);
  return executions.data[0];
}

async function getExecutionDetails(executionId) {
  return await n8nApiRequest(`/executions/${executionId}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🧪 Testing SAM Campaign Execution v3 Workflow\n');

  // Step 1: Find the workflow
  console.log('📋 Step 1: Finding workflow...');
  const workflow = await findWorkflowByName('SAM Campaign Execution v3');

  if (!workflow) {
    console.error('\n❌ ERROR: Workflow "SAM Campaign Execution v3" not found!');
    console.log('\nPlease create the workflow manually in the n8n UI first.');
    console.log('Follow: N8N_MANUAL_WORKFLOW_CREATION_GUIDE.md');
    process.exit(1);
  }

  console.log(`✅ Found workflow: ${workflow.name}`);
  console.log(`   ID: ${workflow.id}`);
  console.log(`   Active: ${workflow.active ? 'Yes' : 'No'}`);
  console.log(`   Nodes: ${workflow.nodes?.length || 0}`);

  if (!workflow.active) {
    console.warn('\n⚠️  WARNING: Workflow is not active!');
    console.log('Please activate it in the n8n UI before testing.');
    process.exit(1);
  }

  // Step 2: Send webhook request
  console.log('\n📤 Step 2: Sending webhook request...');
  console.log(`   URL: ${WEBHOOK_URL}`);
  console.log(`   Prospects: ${testPayload.prospects.length}`);

  const webhookStart = Date.now();
  const webhookResponse = await sendWebhook(WEBHOOK_URL, testPayload);
  const webhookDuration = Date.now() - webhookStart;

  console.log(`✅ Webhook responded in ${webhookDuration}ms`);
  console.log(`   Status: ${webhookResponse.statusCode}`);
  console.log(`   Response: ${webhookResponse.body}`);

  // Step 3: Wait for execution to complete
  console.log('\n⏳ Step 3: Waiting for execution (5 seconds)...');
  await sleep(5000);

  // Step 4: Check execution
  console.log('\n📊 Step 4: Checking execution results...');
  const execution = await getLatestExecution(workflow.id);

  if (!execution) {
    console.error('❌ No execution found!');
    console.log('\nPossible issues:');
    console.log('- Workflow not triggered');
    console.log('- Webhook path incorrect');
    console.log('- Workflow not active');
    process.exit(1);
  }

  console.log(`✅ Found execution: ${execution.id}`);
  console.log(`   Status: ${execution.status}`);
  console.log(`   Finished: ${execution.finished}`);
  console.log(`   Mode: ${execution.mode}`);
  console.log(`   Started: ${execution.startedAt}`);

  if (execution.stoppedAt) {
    const duration = new Date(execution.stoppedAt) - new Date(execution.startedAt);
    console.log(`   Duration: ${duration}ms`);

    // Check for the telltale sign of broken workflows
    if (duration < 100) {
      console.error('\n❌ CRITICAL: Execution too fast (< 100ms)');
      console.error('This indicates the workflow is not processing data properly!');
      console.log('\n🔧 Recommended actions:');
      console.log('1. DELETE this workflow');
      console.log('2. Create a NEW workflow from scratch in the UI');
      console.log('3. DO NOT copy/paste JSON - build node by node');
      process.exit(1);
    }
  }

  // Step 5: Get detailed execution data
  console.log('\n🔍 Step 5: Analyzing execution details...');
  const details = await getExecutionDetails(execution.id);

  console.log('\nNode Execution Results:');
  console.log('─'.repeat(60));

  let hasData = false;
  let nodeCount = 0;

  if (details.data?.resultData?.runData) {
    const runData = details.data.resultData.runData;

    for (const [nodeName, nodeData] of Object.entries(runData)) {
      nodeCount++;
      const hasNodeData = nodeData && nodeData.length > 0 && nodeData[0]?.data?.main?.[0]?.length > 0;

      console.log(`\n${hasNodeData ? '✅' : '❌'} ${nodeName}`);

      if (hasNodeData) {
        hasData = true;
        const items = nodeData[0].data.main[0];
        console.log(`   Items: ${items.length}`);

        // Show sample data from first item
        if (items[0]?.json) {
          const keys = Object.keys(items[0].json);
          console.log(`   Fields: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`);
        }
      } else {
        console.log('   Data: NO DATA (this is bad!)');
      }
    }
  } else {
    console.log('❌ No execution data found!');
  }

  console.log('\n' + '─'.repeat(60));

  // Step 6: Final verdict
  console.log('\n📋 Test Summary:\n');

  const checks = {
    'Workflow found': !!workflow,
    'Workflow active': workflow?.active,
    'Webhook responded': webhookResponse.statusCode === 200,
    'Execution created': !!execution,
    'Execution finished': execution?.finished,
    'Duration > 100ms': execution?.stoppedAt && (new Date(execution.stoppedAt) - new Date(execution.startedAt)) > 100,
    'Nodes have data': hasData,
    'All nodes executed': nodeCount >= 6
  };

  for (const [check, passed] of Object.entries(checks)) {
    console.log(`${passed ? '✅' : '❌'} ${check}`);
  }

  const allPassed = Object.values(checks).every(v => v);

  if (allPassed) {
    console.log('\n🎉 SUCCESS! Workflow is working correctly!\n');
    console.log('✅ The workflow is processing data through all nodes');
    console.log('✅ Execution time is normal (not 30ms instant completion)');
    console.log('✅ Ready for production use');
    console.log('\n📋 Next steps:');
    console.log('1. Update .env.local with webhook URL');
    console.log('2. Test from SAM application');
    console.log('3. Monitor first few campaign executions');
  } else {
    console.log('\n❌ WORKFLOW HAS ISSUES\n');
    console.log('The workflow is not functioning correctly.');
    console.log('\n🔧 Recommended actions:');
    console.log('1. Review N8N_MANUAL_WORKFLOW_CREATION_GUIDE.md');
    console.log('2. Check all node connections in UI');
    console.log('3. Verify expressions in HTTP Request node');
    console.log('4. Test each node individually in UI');
    console.log('\nIf issues persist, DELETE and recreate the workflow.');
  }

  console.log('\n📊 Execution Details:');
  console.log(`   Execution ID: ${execution.id}`);
  console.log(`   View in UI: https://workflows.innovareai.com/execution/${execution.id}`);
}

main().catch(err => {
  console.error('\n❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
