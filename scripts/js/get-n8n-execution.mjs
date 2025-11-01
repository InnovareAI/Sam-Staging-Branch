#!/usr/bin/env node

/**
 * Fetch N8N Execution Details
 * Gets the actual execution data from N8N API
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://innovareai.app.n8n.cloud';
const N8N_API_KEY = process.env.N8N_API_KEY;

const executionId = process.argv[2];

if (!executionId) {
  console.log('❌ Usage: node get-n8n-execution.mjs <execution_id>');
  console.log('Example: node get-n8n-execution.mjs 234802');
  process.exit(1);
}

if (!N8N_API_KEY) {
  console.log('❌ N8N_API_KEY not set in environment');
  process.exit(1);
}

console.log(`🔍 Fetching N8N Execution: ${executionId}\n`);

try {
  const response = await fetch(
    `${N8N_API_URL}/api/v1/executions/${executionId}`,
    {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    console.log(`❌ Failed to fetch execution: ${response.status} ${response.statusText}`);
    const errorText = await response.text();
    console.log(errorText);
    process.exit(1);
  }

  const execution = await response.json();

  console.log('✅ Execution Found:\n');
  console.log('━'.repeat(80));
  console.log('📊 EXECUTION DETAILS');
  console.log('━'.repeat(80));
  console.log(`ID: ${execution.id}`);
  console.log(`Workflow ID: ${execution.workflowId}`);
  console.log(`Status: ${execution.status}`);
  console.log(`Started: ${execution.startedAt}`);
  console.log(`Finished: ${execution.finishedAt}`);
  console.log(`Mode: ${execution.mode}`);

  if (execution.data && execution.data.resultData) {
    console.log('\n━'.repeat(80));
    console.log('📋 NODE EXECUTION RESULTS');
    console.log('━'.repeat(80));

    const nodes = execution.data.resultData.runData;

    for (const [nodeName, nodeRuns] of Object.entries(nodes)) {
      console.log(`\n📌 Node: ${nodeName}`);

      for (let i = 0; i < nodeRuns.length; i++) {
        const run = nodeRuns[i];
        console.log(`   Run ${i + 1}:`);
        console.log(`   - Started: ${run.startTime}`);
        console.log(`   - Execution Time: ${run.executionTime}ms`);

        if (run.data && run.data.main) {
          const outputs = run.data.main[0];
          if (outputs && outputs.length > 0) {
            console.log(`   - Output Items: ${outputs.length}`);

            // For Unipile/LinkedIn nodes, show the response
            if (nodeName.toLowerCase().includes('unipile') ||
                nodeName.toLowerCase().includes('linkedin') ||
                nodeName.toLowerCase().includes('send')) {
              console.log('\n   📨 Output Data:');
              outputs.forEach((output, idx) => {
                console.log(`   Item ${idx + 1}:`);
                console.log(JSON.stringify(output.json, null, 4));
              });
            }
          }
        }

        if (run.error) {
          console.log(`   ❌ Error: ${JSON.stringify(run.error, null, 4)}`);
        }
      }
    }
  }

  // Look specifically for Unipile response
  console.log('\n━'.repeat(80));
  console.log('🔍 SEARCHING FOR UNIPILE RESPONSE');
  console.log('━'.repeat(80));

  let foundUnipileResponse = false;

  if (execution.data && execution.data.resultData && execution.data.resultData.runData) {
    const nodes = execution.data.resultData.runData;

    for (const [nodeName, nodeRuns] of Object.entries(nodes)) {
      if (nodeName.toLowerCase().includes('unipile') ||
          nodeName.toLowerCase().includes('send') ||
          nodeName.toLowerCase().includes('invitation')) {

        console.log(`\n📌 Found relevant node: ${nodeName}`);

        for (const run of nodeRuns) {
          if (run.data && run.data.main && run.data.main[0]) {
            const outputs = run.data.main[0];
            outputs.forEach(output => {
              foundUnipileResponse = true;
              console.log('\n✅ Unipile API Response:');
              console.log(JSON.stringify(output.json, null, 2));

              // Check for message ID
              const data = output.json;
              const messageId = data.object?.id ||
                              data.id ||
                              data.data?.id ||
                              data.message_id ||
                              data.invitation_id;

              if (messageId) {
                console.log(`\n✅ Message ID Found: ${messageId}`);
              } else {
                console.log('\n❌ NO MESSAGE ID IN RESPONSE!');
                console.log('   This means Unipile returned success but no tracking ID');
                console.log('   Message was likely NOT sent to LinkedIn');
              }
            });
          }
        }
      }
    }
  }

  if (!foundUnipileResponse) {
    console.log('\n❌ No Unipile response found in execution');
    console.log('   This suggests the Send node never executed');
    console.log('   Or the workflow failed before reaching that node');
  }

  console.log('\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
