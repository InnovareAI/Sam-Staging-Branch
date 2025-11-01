#!/usr/bin/env node

/**
 * List Recent N8N Executions
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://innovareai.app.n8n.cloud';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.log('❌ N8N_API_KEY not set in environment');
  process.exit(1);
}

console.log('🔍 Fetching recent N8N executions...\n');

try {
  const response = await fetch(
    `${N8N_API_URL}/api/v1/executions?limit=20`,
    {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    console.log(`❌ Failed to fetch executions: ${response.status} ${response.statusText}`);
    const errorText = await response.text();
    console.log(errorText);
    process.exit(1);
  }

  const result = await response.json();
  const executions = result.data || result;

  if (!executions || executions.length === 0) {
    console.log('❌ No executions found');
    process.exit(0);
  }

  console.log(`✅ Found ${executions.length} recent executions:\n`);
  console.log('━'.repeat(100));

  for (const exec of executions) {
    const status = exec.status === 'success' ? '✅' : exec.status === 'error' ? '❌' : '⏸️';
    const duration = exec.finishedAt && exec.startedAt
      ? ((new Date(exec.finishedAt) - new Date(exec.startedAt)) / 1000).toFixed(2)
      : 'N/A';

    console.log(`${status} ID: ${exec.id} | ${exec.workflowName || exec.workflowId} | ${exec.status}`);
    console.log(`   Started: ${exec.startedAt}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Mode: ${exec.mode}`);

    if (exec.status === 'error' && exec.stoppedAt) {
      console.log(`   ❌ Stopped: ${exec.stoppedAt}`);
    }

    console.log();
  }

  console.log('━'.repeat(100));
  console.log('\n💡 To see details of an execution:');
  console.log('   node scripts/js/get-n8n-execution.mjs <execution_id>');
  console.log('\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
