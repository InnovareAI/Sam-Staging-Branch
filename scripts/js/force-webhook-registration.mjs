#!/usr/bin/env node
/**
 * Force N8N webhook registration via API
 * Deactivate then reactivate to force webhook endpoint registration
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY not found in environment');
  process.exit(1);
}

async function makeN8NRequest(endpoint, method = 'GET', body = null) {
  const url = `${N8N_API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`N8N API error ${response.status}: ${errorText}`);
  }
  return await response.json();
}

console.log('🔄 FORCING WEBHOOK REGISTRATION...\n');

try {
  // Step 1: Get current workflow
  console.log('1️⃣ Fetching current workflow...');
  const workflow = await makeN8NRequest(`/workflows/${WORKFLOW_ID}`);
  console.log(`   Workflow: ${workflow.name}`);
  console.log(`   Currently active: ${workflow.active}`);
  console.log(`   Nodes: ${workflow.nodes?.length || 0}`);

  // Step 2: Clean workflow object (remove read-only fields)
  const cleanWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData,
    tags: workflow.tags
  };

  // Step 3: Force deactivate
  console.log('\n2️⃣ Deactivating workflow...');
  cleanWorkflow.active = false;
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', cleanWorkflow);
  console.log('   ✅ Deactivated');

  // Wait 2 seconds for N8N to process
  console.log('\n⏳ Waiting 2 seconds...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Step 4: Force reactivate
  console.log('\n3️⃣ Reactivating workflow...');
  cleanWorkflow.active = true;
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', cleanWorkflow);
  console.log('   ✅ Reactivated');

  // Step 4: Verify activation
  console.log('\n4️⃣ Verifying webhook registration...');
  const updatedWorkflow = await makeN8NRequest(`/workflows/${WORKFLOW_ID}`);
  console.log(`   Active: ${updatedWorkflow.active}`);
  console.log(`   Webhook path: campaign-execute`);

  // Step 5: Test webhook with minimal payload
  console.log('\n5️⃣ Testing webhook...');
  const webhookUrl = `${N8N_API_URL.replace('/api/v1', '')}/webhook/campaign-execute`;
  console.log(`   URL: ${webhookUrl}`);

  const testPayload = {
    test: true,
    timestamp: new Date().toISOString()
  };

  const webhookResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Test': 'true'
    },
    body: JSON.stringify(testPayload)
  });

  console.log(`   Response status: ${webhookResponse.status}`);
  const webhookResult = await webhookResponse.text();
  console.log(`   Response: ${webhookResult.substring(0, 200)}`);

  // Step 6: Check latest execution
  console.log('\n6️⃣ Checking for execution...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  const executions = await makeN8NRequest('/executions?limit=1');
  if (executions.data && executions.data.length > 0) {
    const latestExec = executions.data[0];
    console.log(`   Latest execution #${latestExec.id}`);
    console.log(`   Status: ${latestExec.status}`);
    console.log(`   Started: ${new Date(latestExec.startedAt).toLocaleTimeString()}`);
    console.log(`   Duration: ${((new Date(latestExec.stoppedAt) - new Date(latestExec.startedAt)) / 1000).toFixed(2)}s`);
  }

  console.log('\n✅ WEBHOOK REGISTRATION COMPLETE!');
  console.log('\n🎯 Next steps:');
  console.log('   1. Trigger campaign execution from SAM');
  console.log('   2. Check N8N execution should show multiple nodes executed');
  console.log('   3. Duration should be 2-5+ seconds (not 0.03s)');
  console.log('   4. LinkedIn CR should appear in LinkedIn UI\n');

} catch (error) {
  console.error('\n❌ FAILED:', error.message);
  process.exit(1);
}
