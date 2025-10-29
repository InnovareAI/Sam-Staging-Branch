#!/usr/bin/env node
import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

const response = await fetch(`${N8N_API_URL}/executions?workflowId=${WORKFLOW_ID}&limit=5`, {
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY
  }
});

const data = await response.json();

console.log('\n🔍 Latest 5 N8N Executions:\n');
data.data?.forEach((exec, i) => {
  const duration = exec.stoppedAt ? ((new Date(exec.stoppedAt) - new Date(exec.startedAt)) / 1000).toFixed(2) : 'N/A';
  const time = new Date(exec.startedAt).toLocaleTimeString();
  console.log(`${i + 1}. Execution #${exec.id}`);
  console.log(`   Status: ${exec.status}`);
  console.log(`   Time: ${time}`);
  console.log(`   Duration: ${duration}s\n`);
});

const latest = data.data?.[0];
if (latest) {
  console.log(`\n🎯 Checking latest execution #${latest.id}...\n`);

  const detailResponse = await fetch(`${N8N_API_URL}/executions/${latest.id}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  const detail = await detailResponse.json();
  const webhookData = detail.data?.resultData?.runData?.['Campaign Execute Webhook']?.[0]?.data?.main?.[0]?.[0]?.json;

  console.log('🏷️  Metadata:');
  console.log('  Workspace:', webhookData?.workspace_name || '❌ MISSING');
  console.log('  Campaign:', webhookData?.campaign_name || '❌ MISSING');
  console.log('  LinkedIn Account:', webhookData?.linkedin_account_name || '❌ MISSING');

  if (!webhookData) {
    console.log('\n⚠️  No webhook data - workflow might have failed immediately');
  }
}
