const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ';
const WORKFLOW_ID = 'pWxsl8D5irntaRwR';
const N8N_HOST = 'workflows.innovareai.com';

// Get the workflow
function getWorkflow() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: N8N_HOST,
      path: `/api/v1/workflows/${WORKFLOW_ID}`,
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Update the workflow
function updateWorkflow(workflow) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(workflow);

    const options = {
      hostname: N8N_HOST,
      path: `/api/v1/workflows/${WORKFLOW_ID}`,
      method: 'PUT',
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function fixWorkflow() {
  console.log('🔧 Fixing N8N Workflow: Get LinkedIn Profile Error\n');
  console.log('='.repeat(70));

  try {
    console.log('\n📥 Fetching workflow...');
    const workflow = await getWorkflow();

    console.log(`✅ Workflow: ${workflow.name}`);
    console.log(`   ID: ${workflow.id}`);
    console.log(`   Active: ${workflow.active}`);

    // Find the "Extract Campaign Data" node
    const extractNode = workflow.nodes.find(n => n.name === 'Extract Campaign Data');

    if (!extractNode) {
      console.log('\n❌ Could not find "Extract Campaign Data" node');
      return;
    }

    console.log('\n📝 Current "Extract Campaign Data" code:');
    console.log(extractNode.parameters.jsCode);

    // FIXED CODE: Get unipileAccountId from top level OR nested path
    const fixedCode = `// Extract and validate campaign data
const webhookData = $input.all()[0].json;

// CRITICAL FIX: Get unipileAccountId from top level (new format) or nested path (old format)
const unipileAccountId = webhookData.unipileAccountId ||
  webhookData.workspace_config?.integration_config?.linkedin_accounts?.[0]?.unipile_account_id;

if (!unipileAccountId) {
  throw new Error('Missing unipileAccountId in webhook data. Check payload format.');
}

return [{
  json: {
    campaign_id: webhookData.campaign_id || webhookData.campaignId,
    workspace_id: webhookData.workspace_id || webhookData.workspaceId,
    prospects: webhookData.prospects || webhookData.campaign_data?.prospects || [],
    messages: webhookData.campaign_data?.message_templates || {},
    unipile_account_id: unipileAccountId,  // Now properly extracted
    total_prospects: (webhookData.prospects || webhookData.campaign_data?.prospects || []).length
  }
}];`;

    console.log('\n✅ Updated code with unipileAccountId fix\n');

    // Update the node
    extractNode.parameters.jsCode = fixedCode;

    console.log('📤 Pushing update to N8N...');
    const result = await updateWorkflow(workflow);

    console.log('\n✅ WORKFLOW UPDATED SUCCESSFULLY!');
    console.log(`   Updated at: ${result.updatedAt}`);
    console.log('\n' + '='.repeat(70));
    console.log('\n💡 CHANGES APPLIED:');
    console.log('1. "Extract Campaign Data" now gets unipileAccountId from webhook top level');
    console.log('2. Falls back to old nested path for backwards compatibility');
    console.log('3. Throws clear error if unipileAccountId is missing');
    console.log('\n✅ The "Get LinkedIn Profile" error should now be fixed!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

fixWorkflow();
