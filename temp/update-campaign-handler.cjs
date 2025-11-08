const fs = require('fs');

const N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ";
const N8N_URL = "https://workflows.innovareai.com";
const WORKFLOW_ID = "aVG6LC4ZFRMN7Bw6";

async function updateCampaignHandler() {
  console.log('🔄 Updating Campaign Handler node...\n');

  // Read the current workflow
  const workflow = JSON.parse(fs.readFileSync('/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/funnel-workflow.json', 'utf8'));

  // Read the new function code
  const newFunctionCode = fs.readFileSync('/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/updated-campaign-handler.js', 'utf8');

  // Find and update the Campaign Handler node
  const campaignHandlerNode = workflow.nodes.find(n => n.name === 'Campaign Handler');

  if (!campaignHandlerNode) {
    console.error('❌ Campaign Handler node not found');
    return;
  }

  console.log('✅ Found Campaign Handler node');
  console.log('📝 Updating function code...\n');

  // Update the function code
  campaignHandlerNode.parameters.functionCode = newFunctionCode;

  // Clean workflow object - remove readonly properties
  const cleanWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  // Update the workflow via N8N API
  const response = await fetch(`${N8N_URL}/api/v1/workflows/${WORKFLOW_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY
    },
    body: JSON.stringify(cleanWorkflow)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Failed to update workflow:', error);
    return;
  }

  const result = await response.json();
  console.log('✅ Campaign Handler updated successfully!');
  console.log(`   Workflow: ${result.name}`);
  console.log(`   Active: ${result.active}`);
  console.log('\n🔍 The next campaign execution will show detailed logs');
  console.log('   Check N8N execution logs for debugging info');
}

updateCampaignHandler().catch(console.error);
