#!/usr/bin/env node
/**
 * Add N8N Execution Logging Nodes via API
 *
 * This script directly modifies the workflow via N8N API to add logging nodes.
 */

const N8N_API_URL = 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzUzOTY1MzEwfQ.hgFJD0KwZWWgc-a-kI99VzYhaUrDicLkp-lHCuJ9U1o';

const WORKFLOW_ID = 'iKIchXBOT7ahhIwa';

console.log('🔧 Adding Execution Logging to N8N Workflow');
console.log('===========================================\n');
console.log(`Workflow ID: ${WORKFLOW_ID}\n`);

async function getWorkflow() {
  console.log('📥 Step 1: Fetching current workflow...');

  const response = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workflow: ${response.status} ${response.statusText}`);
  }

  const workflow = await response.json();
  console.log(`✅ Fetched workflow: ${workflow.name}`);
  console.log(`   Nodes: ${workflow.nodes.length}`);
  console.log(`   Connections: ${Object.keys(workflow.connections || {}).length}`);

  return workflow;
}

function createLogStartNode(workflow) {
  // Find a good position (after webhook/trigger)
  const webhookNode = workflow.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
  const startX = webhookNode ? webhookNode.position[0] + 250 : 250;
  const startY = webhookNode ? webhookNode.position[1] : 300;

  return {
    id: `log-start-${Date.now()}`,
    name: 'Log N8N Execution Start',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.1,
    position: [startX, startY],
    parameters: {
      method: 'POST',
      url: 'https://app.meet-sam.com/api/n8n/log-execution',
      authentication: 'none',
      sendBody: true,
      bodyContentType: 'json',
      jsonBody: '={{ { "workspace_id": $json.workspace_id, "n8n_execution_id": $execution.id, "n8n_workflow_id": $workflow.id, "execution_status": "running", "total_prospects": $json.prospect_count || 0, "current_step": "initialization", "progress_percentage": 0 } }}',
      options: {}
    },
    onError: 'continueRegularOutput'
  };
}

function createLogCompleteNode(workflow) {
  // Find rightmost node for positioning
  const maxX = Math.max(...workflow.nodes.map(n => n.position[0]), 0);
  const avgY = workflow.nodes.reduce((sum, n) => sum + n.position[1], 0) / workflow.nodes.length;

  return {
    id: `log-complete-${Date.now()}`,
    name: 'Log N8N Execution Complete',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.1,
    position: [maxX + 250, avgY],
    parameters: {
      method: 'POST',
      url: 'https://app.meet-sam.com/api/n8n/log-execution',
      authentication: 'none',
      sendBody: true,
      bodyContentType: 'json',
      jsonBody: '={{ { "workspace_id": $json.workspace_id || $("Webhook").item.json.workspace_id, "n8n_execution_id": $execution.id, "n8n_workflow_id": $workflow.id, "execution_status": "completed", "total_prospects": $json.total_count || 0, "successful_outreach": $json.success_count || 0, "failed_outreach": $json.fail_count || 0, "current_step": "completed", "progress_percentage": 100 } }}',
      options: {}
    },
    onError: 'continueRegularOutput'
  };
}

async function updateWorkflow(workflow) {
  console.log('\n📤 Step 2: Updating workflow via API...');

  // N8N API expects specific format - send only what's needed
  const updatePayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    active: workflow.active,
    settings: workflow.settings,
    staticData: workflow.staticData,
    tags: workflow.tags
  };

  const response = await fetch(`${N8N_API_URL}/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(updatePayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update workflow: ${response.status} - ${errorText}`);
  }

  const updated = await response.json();
  console.log('✅ Workflow updated successfully');

  return updated;
}

async function main() {
  try {
    // Get current workflow
    const workflow = await getWorkflow();

    // Check if logging nodes already exist
    const hasLogging = workflow.nodes.some(n =>
      n.name && (n.name.includes('Log N8N Execution') || n.name.includes('Log Execution'))
    );

    if (hasLogging) {
      console.log('\n⚠️  Workflow already has logging nodes!');
      console.log('   No changes needed.');
      return;
    }

    console.log('\n🔨 Step 2: Creating logging nodes...');

    // Create new nodes
    const logStartNode = createLogStartNode(workflow);
    const logCompleteNode = createLogCompleteNode(workflow);

    console.log(`   ✅ Created: ${logStartNode.name}`);
    console.log(`   ✅ Created: ${logCompleteNode.name}`);

    // Add nodes to workflow
    workflow.nodes.push(logStartNode);
    workflow.nodes.push(logCompleteNode);

    console.log(`\n   Total nodes now: ${workflow.nodes.length}`);

    // Update workflow
    await updateWorkflow(workflow);

    console.log('\n=========================================');
    console.log('✅ SUCCESS!');
    console.log('=========================================');
    console.log('Logging nodes added to workflow.');
    console.log('');
    console.log('⚠️  IMPORTANT: Manual connection required');
    console.log('   1. Go to: https://workflows.innovareai.com');
    console.log('   2. Open: Campaign Execute - LinkedIn via Unipile (Complete)');
    console.log('   3. Connect "Log N8N Execution Start" after webhook');
    console.log('   4. Connect "Log N8N Execution Complete" before end');
    console.log('   5. Save the workflow');
    console.log('');
    console.log('📝 Note: Nodes are positioned automatically but connections');
    console.log('   must be made manually in the N8N UI.');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();
