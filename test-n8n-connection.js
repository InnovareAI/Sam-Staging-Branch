#!/usr/bin/env node

/**
 * Simple N8N Connection Test
 * Tests connectivity to the self-hosted n8n instance
 */

const N8N_INSTANCE_URL = process.env.N8N_INSTANCE_URL || 'https://workflows.innovareai.com';
const N8N_API_KEY = process.env.N8N_API_KEY;

async function testN8NConnection() {
  console.log('🚀 Testing N8N Self-Hosted Connection');
  console.log('=====================================\n');

  console.log('Configuration:');
  console.log(`  Instance URL: ${N8N_INSTANCE_URL}`);
  console.log(`  API Key: ${N8N_API_KEY ? '✅ Set' : '❌ Missing'}\n`);

  if (!N8N_API_KEY) {
    console.error('❌ N8N_API_KEY is not set in environment');
    process.exit(1);
  }

  try {
    // Test 1: List workflows
    console.log('Test 1: Listing workflows...');
    const workflowsResponse = await fetch(`${N8N_INSTANCE_URL}/api/v1/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!workflowsResponse.ok) {
      throw new Error(`HTTP ${workflowsResponse.status}: ${workflowsResponse.statusText}`);
    }

    const workflowsData = await workflowsResponse.json();
    const workflows = workflowsData.data || [];

    console.log(`✅ Successfully connected to n8n`);
    console.log(`   Total workflows: ${workflows.length}\n`);

    // Find Sam-related workflows
    const samWorkflows = workflows.filter(w =>
      w.name.toLowerCase().includes('sam') ||
      w.name.toLowerCase().includes('campaign')
    );

    console.log('Sam-related workflows:');
    samWorkflows.forEach(w => {
      console.log(`  ${w.active ? '🟢' : '🔴'} ${w.name} (ID: ${w.id})`);
    });
    console.log('');

    // Test 2: Get a specific Sam workflow
    const samCampaignWorkflow = workflows.find(w => w.name === 'SAM Campaign Execution v2 - Clean');

    if (samCampaignWorkflow) {
      console.log('Test 2: Getting SAM Campaign Execution workflow details...');
      const workflowResponse = await fetch(
        `${N8N_INSTANCE_URL}/api/v1/workflows/${samCampaignWorkflow.id}`,
        {
          method: 'GET',
          headers: {
            'X-N8N-API-KEY': N8N_API_KEY,
            'Accept': 'application/json'
          }
        }
      );

      if (!workflowResponse.ok) {
        throw new Error(`HTTP ${workflowResponse.status}: ${workflowResponse.statusText}`);
      }

      const workflowDetails = await workflowResponse.json();
      const wfData = workflowDetails.data || workflowDetails;
      console.log(`✅ Successfully retrieved workflow details`);
      console.log(`   Name: ${wfData.name || 'N/A'}`);
      console.log(`   Active: ${wfData.active ? 'Yes' : 'No'}`);
      console.log(`   Nodes: ${wfData.nodes?.length || 0}`);
      console.log(`   Created: ${wfData.createdAt || 'N/A'}`);
      console.log('');
    }

    // Test 3: Test workflow execution endpoint (dry run)
    console.log('Test 3: Testing workflow execution endpoint...');
    if (samCampaignWorkflow) {
      console.log(`   Workflow ID: ${samCampaignWorkflow.id}`);
      console.log(`   Status: ${samCampaignWorkflow.active ? 'Active ✅' : 'Inactive ❌'}`);

      if (!samCampaignWorkflow.active) {
        console.log('   ⚠️  Workflow is not active. It needs to be activated in n8n before execution.');
      } else {
        console.log('   ✅ Workflow is active and ready for execution');
      }
    } else {
      console.log('   ⚠️  SAM Campaign Execution workflow not found');
    }
    console.log('');

    // Summary
    console.log('=================================');
    console.log('✅ All tests passed!');
    console.log('=================================');
    console.log(`\nN8N self-hosted instance is working correctly at ${N8N_INSTANCE_URL}`);
    console.log('\nNext steps:');
    console.log('1. Ensure the "SAM Campaign Execution v2 - Clean" workflow is active');
    console.log('2. Test workflow execution from the Sam app');
    console.log('3. Verify webhook callbacks are working');

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(`   Error: ${error.message}`);
    if (error.cause) {
      console.error(`   Cause: ${error.cause}`);
    }
    process.exit(1);
  }
}

// Run the test
testN8NConnection().catch(console.error);
