#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const N8N_URL = process.env.N8N_WEBHOOK_URL || 'https://workflows.innovareai.com';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'dwNO4VpIQEcZNQgs'; // LinkedIn Commenting Agent - Complete (Hardcoded)

console.log('🔍 Checking executions for LinkedIn Commenting workflow...\n');

try {
  const response = await fetch(`${N8N_URL}/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=10`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
    },
  });

  if (!response.ok) {
    console.error('❌ Failed to fetch executions:', response.status, response.statusText);
    process.exit(1);
  }

  const result = await response.json();
  const executions = result.data;

  console.log(`Found ${executions?.length || 0} recent executions:\n`);

  if (executions?.length > 0) {
    executions.forEach((exec, idx) => {
      console.log(`${idx + 1}. Execution ${exec.id}`);
      console.log(`   Status: ${exec.finished ? (exec.status === 'success' ? '✅ Success' : '❌ Failed') : '⏳ Running'}`);
      console.log(`   Started: ${new Date(exec.startedAt).toLocaleString()}`);
      console.log(`   Mode: ${exec.mode}`);
      if (exec.status === 'error') {
        console.log(`   Error: ${exec.error || 'Unknown error'}`);
      }
      console.log('');
    });
  } else {
    console.log('⚠️ No executions found. Workflow may not have run yet.');
    console.log('   Check if the schedule trigger is set to run every 10 minutes.');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
