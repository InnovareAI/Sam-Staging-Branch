const fs = require('fs');
const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ';
const WORKFLOW_ID = 'pWxsl8D5irntaRwR';
const N8N_HOST = 'workflows.innovareai.com';

const NEW_CODE = `// Extract and validate campaign data
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
    unipile_account_id: unipileAccountId,
    total_prospects: (webhookData.prospects || webhookData.campaign_data?.prospects || []).length
  }
}];`;

async function updateWorkflow() {
  console.log('🔧 Applying N8N Workflow Fix\n');
  console.log('='.repeat(70));

  // Read the workflow
  const workflow = JSON.parse(fs.readFileSync('n8n-workflow-current.json', 'utf8'));

  console.log(`\n📝 Workflow: ${workflow.name}`);
  console.log(`   ID: ${workflow.id}`);

  // Find and update the Extract Campaign Data node
  const extractNode = workflow.nodes.find(n => n.name === 'Extract Campaign Data');

  if (!extractNode) {
    console.log('\n❌ Could not find "Extract Campaign Data" node');
    return;
  }

  console.log('\n🔍 Found "Extract Campaign Data" node');
  console.log('   Old code length:', extractNode.parameters.jsCode.length);

  // Apply the fix
  extractNode.parameters.jsCode = NEW_CODE;

  console.log('   New code length:', extractNode.parameters.jsCode.length);

  // Save updated workflow to file
  fs.writeFileSync('n8n-workflow-updated.json', JSON.stringify(workflow, null, 2));
  console.log('\n💾 Saved updated workflow to n8n-workflow-updated.json');

  // Upload to N8N
  console.log('\n📤 Uploading to N8N...');

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
        if (res.statusCode === 200) {
          console.log('\n✅ WORKFLOW UPDATED SUCCESSFULLY!');
          console.log('\n' + '='.repeat(70));
          console.log('\n💡 CHANGES APPLIED:');
          console.log('1. "Extract Campaign Data" now gets unipileAccountId from webhook top level');
          console.log('2. Falls back to old nested path for backwards compatibility');
          console.log('3. Throws clear error if unipileAccountId is missing');
          console.log('\n✅ The "Get LinkedIn Profile" error should now be fixed!');
          console.log('\n🧪 Test with a campaign execution to verify.\n');
          resolve();
        } else {
          console.log(`\n❌ Upload failed: HTTP ${res.statusCode}`);
          console.log('Response:', data);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('\n❌ Request error:', error.message);
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

updateWorkflow().catch(console.error);
