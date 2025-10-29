#!/usr/bin/env node
/**
 * PROPERLY ACTIVATE N8N WORKFLOW
 *
 * Root cause: Workflow shows active=true in API but webhook not registered
 * Solution: Deactivate, wait, then reactivate to force webhook registration
 */

const N8N_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA';
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

console.log('🔧 Properly activating N8N workflow...\n');

// Step 1: Deactivate
console.log('1️⃣  Deactivating workflow...');
await fetch(`https://workflows.innovareai.com/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PATCH',
  headers: {
    'X-N8N-API-KEY': N8N_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ active: false })
});

console.log('   ✅ Deactivated\n');

// Step 2: Wait for N8N to unregister webhook
console.log('2️⃣  Waiting 3 seconds for webhook unregistration...');
await new Promise(resolve => setTimeout(resolve, 3000));
console.log('   ✅ Done\n');

// Step 3: Reactivate
console.log('3️⃣  Reactivating workflow...');
const activateResp = await fetch(`https://workflows.innovareai.com/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PATCH',
  headers: {
    'X-N8N-API-KEY': N8N_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ active: true })
});

const activateData = await activateResp.json();
console.log('   ✅ Reactivated\n');

// Step 4: Verify webhook registration
console.log('4️⃣  Verifying webhook registration...');
await new Promise(resolve => setTimeout(resolve, 2000));

const testResp = await fetch('https://workflows.innovareai.com/webhook-test/campaign-execute', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' }
});

const testText = await testResp.text();

if (testResp.status === 404 && testText.includes('not registered')) {
  console.log('   ❌ WEBHOOK STILL NOT REGISTERED!');
  console.log('   Manual action required:');
  console.log('   1. Go to: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6');
  console.log('   2. Toggle workflow OFF then ON using the switch');
  console.log('   3. Click "Execute Workflow" button once');
  console.log('   4. Then test webhook again\n');
  process.exit(1);
} else {
  console.log('   ✅ Webhook registered!\n');
}

// Step 5: Test webhook
console.log('5️⃣  Testing webhook trigger...');
const webhookResp = await fetch('https://workflows.innovareai.com/webhook/campaign-execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspace_id: 'activation-test',
    campaign_id: 'test-campaign',
    unipile_account_id: 'test-account',
    prospects: [{id: 'p1', first_name: 'Test', linkedin_url: 'https://linkedin.com/in/test'}],
    messages: {cr: 'Activation test message'},
    timing: {fu1_delay_days: 2}
  })
});

const webhookData = await webhookResp.json();
console.log('   Response:', JSON.stringify(webhookData));

if (webhookData.message === 'Workflow was started') {
  console.log('   ✅ Webhook triggered\n');
} else {
  console.log('   ⚠️  Unexpected response\n');
}

// Step 6: Check execution
console.log('6️⃣  Checking execution (waiting 5s)...');
await new Promise(resolve => setTimeout(resolve, 5000));

const execResp = await fetch(`https://workflows.innovareai.com/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=1`, {
  headers: {'X-N8N-API-KEY': N8N_KEY}
});

const execData = await execResp.json();

if (execData.data?.[0]) {
  const latestExec = execData.data[0];

  // Get execution details
  const detailResp = await fetch(`https://workflows.innovareai.com/api/v1/executions/${latestExec.id}`, {
    headers: {'X-N8N-API-KEY': N8N_KEY}
  });
  const details = await detailResp.json();

  const nodesRun = Object.keys(details.data?.resultData?.runData || {}).length;
  const duration = ((new Date(details.stoppedAt) - new Date(details.startedAt))/1000).toFixed(3);

  console.log(`   Execution ${latestExec.id}:`);
  console.log(`     Status: ${details.status}`);
  console.log(`     Nodes executed: ${nodesRun}`);
  console.log(`     Duration: ${duration}s`);

  if (nodesRun > 0) {
    console.log('\n✅ SUCCESS! Workflow is now executing properly!\n');
  } else {
    console.log('\n❌ STILL BROKEN: Execution created but no nodes ran');
    console.log('   This indicates a deeper workflow configuration issue\n');
    process.exit(1);
  }
} else {
  console.log('   ❌ No execution found\n');
  process.exit(1);
}

console.log('🎯 Workflow is ready to use!');
console.log('📋 Next: Test with a real campaign via /api/campaigns/linkedin/execute-live');
