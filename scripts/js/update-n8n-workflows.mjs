#!/usr/bin/env node
/**
 * Update N8N Workflows with Execution Logging
 *
 * This script adds execution logging nodes to all campaign workflows in N8N.
 * It automatically detects campaign workflows and adds:
 * - Log Start node (beginning)
 * - Log Complete node (end)
 *
 * Usage:
 *   node scripts/js/update-n8n-workflows.mjs
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_URL || !N8N_API_KEY) {
  console.error('❌ Missing N8N_API_URL or N8N_API_KEY in environment variables');
  process.exit(1);
}

console.log('🔧 N8N Workflow Update Script');
console.log('===============================\n');
console.log(`API URL: ${N8N_API_URL}`);
console.log('');

/**
 * Fetch all workflows from N8N
 */
async function getWorkflows() {
  try {
    const response = await fetch(`${N8N_API_URL}/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`N8N API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('❌ Failed to fetch workflows:', error.message);
    throw error;
  }
}

/**
 * Get single workflow details
 */
async function getWorkflow(workflowId) {
  try {
    const response = await fetch(`${N8N_API_URL}/workflows/${workflowId}`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch workflow ${workflowId}: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Failed to fetch workflow ${workflowId}:`, error.message);
    throw error;
  }
}

/**
 * Check if workflow already has logging nodes
 */
function hasLoggingNodes(workflow) {
  const nodes = workflow.nodes || [];
  return nodes.some(node =>
    node.name && (
      node.name.includes('Log N8N Execution') ||
      node.name.includes('Log Execution') ||
      (node.type === 'n8n-nodes-base.httpRequest' &&
       typeof node.parameters?.url === 'string' &&
       node.parameters.url.includes('/api/n8n/log-execution'))
    )
  );
}

/**
 * Check if this is a campaign workflow
 */
function isCampaignWorkflow(workflow) {
  const name = workflow.name.toLowerCase();
  return (
    name.includes('campaign') ||
    name.includes('orchestration') ||
    name.includes('outreach') ||
    name.includes('prospect')
  );
}

/**
 * Create logging node configuration
 */
function createLogStartNode(position = [400, 300]) {
  return {
    parameters: {
      method: 'POST',
      url: 'https://app.meet-sam.com/api/n8n/log-execution',
      authentication: 'none',
      sendBody: true,
      bodyContentType: 'json',
      jsonBody: '={{ \n  {\n    "workspace_id": $json.workspace_id,\n    "n8n_execution_id": $execution.id,\n    "n8n_workflow_id": $workflow.id,\n    "execution_status": "running",\n    "total_prospects": $json.prospect_count || 0,\n    "current_step": "initialization",\n    "progress_percentage": 0\n  }\n}}',
      options: {}
    },
    name: 'Log N8N Execution Start',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.1,
    position: position,
    onError: 'continueRegularOutput'
  };
}

function createLogCompleteNode(position = [1200, 300]) {
  return {
    parameters: {
      method: 'POST',
      url: 'https://app.meet-sam.com/api/n8n/log-execution',
      authentication: 'none',
      sendBody: true,
      bodyContentType: 'json',
      jsonBody: '={{ \n  {\n    "workspace_id": $("Webhook").item.json.workspace_id || $("Start").item.json.workspace_id,\n    "n8n_execution_id": $execution.id,\n    "n8n_workflow_id": $workflow.id,\n    "execution_status": "completed",\n    "total_prospects": $json.total_count || 0,\n    "successful_outreach": $json.success_count || 0,\n    "failed_outreach": $json.fail_count || 0,\n    "current_step": "completed",\n    "progress_percentage": 100\n  }\n}}',
      options: {}
    },
    name: 'Log N8N Execution Complete',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.1,
    position: position,
    onError: 'continueRegularOutput'
  };
}

/**
 * Update workflow with logging nodes
 */
async function updateWorkflow(workflowId, updatedWorkflow) {
  try {
    const response = await fetch(`${N8N_API_URL}/workflows/${workflowId}`, {
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedWorkflow)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update workflow: ${response.status} - ${error}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Failed to update workflow ${workflowId}:`, error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Step 1: Get all workflows
    console.log('📊 Step 1: Fetching workflows from N8N...\n');
    const workflows = await getWorkflows();
    console.log(`   Found ${workflows.length} workflows\n`);

    // Step 2: Filter campaign workflows
    const campaignWorkflows = workflows.filter(isCampaignWorkflow);
    console.log(`📊 Step 2: Identified ${campaignWorkflows.length} campaign workflows:\n`);

    campaignWorkflows.forEach((wf, i) => {
      console.log(`   ${i + 1}. ${wf.name} (ID: ${wf.id}) - Active: ${wf.active}`);
    });
    console.log('');

    if (campaignWorkflows.length === 0) {
      console.log('ℹ️  No campaign workflows found to update.');
      console.log('   Workflow names should contain: campaign, orchestration, outreach, or prospect');
      return;
    }

    // Step 3: Check which ones need updating
    console.log('📊 Step 3: Checking which workflows need logging...\n');

    const workflowsToUpdate = [];
    for (const wf of campaignWorkflows) {
      const fullWorkflow = await getWorkflow(wf.id);
      const hasLogging = hasLoggingNodes(fullWorkflow);

      console.log(`   ${wf.name}:`);
      console.log(`      Has logging: ${hasLogging ? '✅ Yes' : '❌ No'}`);

      if (!hasLogging) {
        workflowsToUpdate.push(fullWorkflow);
      }
    }
    console.log('');

    if (workflowsToUpdate.length === 0) {
      console.log('✅ All campaign workflows already have logging enabled!');
      return;
    }

    console.log(`⚠️  Found ${workflowsToUpdate.length} workflows needing updates\n`);
    console.log('🚀 Step 4: Adding logging nodes to workflows...\n');

    // Step 4: Update workflows
    for (let i = 0; i < workflowsToUpdate.length; i++) {
      const workflow = workflowsToUpdate[i];
      console.log(`   [${i + 1}/${workflowsToUpdate.length}] Updating: ${workflow.name}`);

      try {
        // Find good positions for new nodes
        const nodes = workflow.nodes || [];
        const maxX = Math.max(...nodes.map(n => n.position?.[0] || 0), 0);
        const avgY = nodes.length > 0
          ? nodes.reduce((sum, n) => sum + (n.position?.[1] || 0), 0) / nodes.length
          : 300;

        // Add logging nodes
        const logStartNode = createLogStartNode([200, avgY]);
        const logCompleteNode = createLogCompleteNode([maxX + 200, avgY]);

        workflow.nodes.push(logStartNode);
        workflow.nodes.push(logCompleteNode);

        // Update workflow
        await updateWorkflow(workflow.id, workflow);
        console.log(`      ✅ Successfully updated`);
      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
      }
    }

    // Step 5: Final report
    console.log('\n=========================================');
    console.log('📊 UPDATE COMPLETE');
    console.log('=========================================');
    console.log(`Total campaign workflows: ${campaignWorkflows.length}`);
    console.log(`Already had logging: ${campaignWorkflows.length - workflowsToUpdate.length}`);
    console.log(`Updated: ${workflowsToUpdate.length}`);
    console.log('');
    console.log('⚠️  IMPORTANT: You must manually connect the logging nodes in N8N UI:');
    console.log('   1. Go to: https://workflows.innovareai.com');
    console.log('   2. Open each updated workflow');
    console.log('   3. Connect "Log N8N Execution Start" after the webhook/trigger');
    console.log('   4. Connect "Log N8N Execution Complete" before the workflow end');
    console.log('   5. Save and activate the workflow');
    console.log('');
    console.log('📖 See docs/N8N-EXECUTION-TRACKING-SETUP.md for detailed instructions');

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
main();
