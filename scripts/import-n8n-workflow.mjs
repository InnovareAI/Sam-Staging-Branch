#!/usr/bin/env node

/**
 * Import N8N Enrichment Workflow via API
 *
 * Uses N8N API to automatically import the prospect enrichment workflow
 */

import fs from 'fs';
import path from 'path';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ Missing N8N_API_KEY environment variable');
  process.exit(1);
}

console.log('🚀 Importing N8N Enrichment Workflow');
console.log('====================================\n');

async function importWorkflow() {
  // Read workflow JSON
  const workflowPath = path.join(process.cwd(), 'n8n-workflows/prospect-enrichment-workflow-fixed.json');

  console.log('📄 Reading workflow file:', workflowPath);

  if (!fs.existsSync(workflowPath)) {
    console.error('❌ Workflow file not found:', workflowPath);
    process.exit(1);
  }

  const rawWorkflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

  console.log('✅ Workflow loaded:', rawWorkflow.name);
  console.log('   Nodes:', rawWorkflow.nodes.length);
  console.log('   Connections:', Object.keys(rawWorkflow.connections).length);

  // Strip fields that N8N API doesn't accept for creation
  const workflowData = {
    name: rawWorkflow.name,
    nodes: rawWorkflow.nodes,
    connections: rawWorkflow.connections,
    settings: rawWorkflow.settings || {}
    // Note: 'active' field is read-only and managed by N8N
  };

  // Check if workflow already exists
  console.log('\n🔍 Checking for existing workflows...');

  try {
    const listResponse = await fetch(`${N8N_API_URL}/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list workflows: ${listResponse.status} ${listResponse.statusText}`);
    }

    const existingWorkflows = await listResponse.json();
    const existing = existingWorkflows.data?.find(w =>
      w.name === workflowData.name || w.name.includes('SAM Prospect Enrichment')
    );

    if (existing) {
      console.log('⚠️  Found existing workflow:', existing.name);
      console.log('   ID:', existing.id);
      console.log('   Active:', existing.active);
      console.log('\n📝 Updating existing workflow instead of creating duplicate...');

      // Update existing workflow
      try {
        const updateResponse = await fetch(`${N8N_API_URL}/workflows/${existing.id}`, {
          method: 'PUT',
          headers: {
            'X-N8N-API-KEY': N8N_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(workflowData)
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update workflow: ${updateResponse.status} ${updateResponse.statusText}\n${errorText}`);
        }

        const updatedWorkflow = await updateResponse.json();

        console.log('\n✅ Workflow updated successfully!');

        // N8N API response can be either { data: {...} } or {...} directly
        const workflow = updatedWorkflow.data || updatedWorkflow;

        console.log('   ID:', workflow.id);
        console.log('   Name:', workflow.name);
        console.log('   Active:', workflow.active);

        displayNextSteps(workflow);
        return;

      } catch (updateError) {
        console.error('❌ Failed to update existing workflow:', updateError.message);
        console.log('\n💡 You can manually import via N8N UI instead');
        process.exit(1);
      }
    }

  } catch (error) {
    console.warn('⚠️  Could not check existing workflows:', error.message);
  }

  // Create new workflow
  console.log('\n📥 Creating new workflow...');

  try {
    const response = await fetch(`${N8N_API_URL}/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflowData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create workflow: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const createdWorkflow = await response.json();

    console.log('\n✅ Workflow imported successfully!');

    // N8N API response can be either { data: {...} } or {...} directly
    const workflow = createdWorkflow.data || createdWorkflow;

    console.log('   ID:', workflow.id);
    console.log('   Name:', workflow.name);
    console.log('   Active:', workflow.active);

    displayNextSteps(workflow);

  } catch (error) {
    console.error('\n❌ Failed to import workflow:', error.message);

    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('   - N8N_API_KEY is correct in .env.local');
      console.log('   - API key has permissions to create workflows');
      console.log('   - N8N instance is accessible');
    }

    if (error.message.includes('400')) {
      console.log('\n💡 Bad request. Workflow JSON may have validation errors.');
      console.log('   Try importing manually via N8N UI:');
      console.log('   1. Go to https://workflows.innovareai.com');
      console.log('   2. Click "Import from File"');
      console.log('   3. Select: n8n-workflows/prospect-enrichment-workflow-fixed.json');
    }

    process.exit(1);
  }
}

function displayNextSteps(workflow) {
  // Find webhook node
  const webhookNode = workflow.nodes?.find(n => n.type === 'n8n-nodes-base.webhook');
  let webhookUrl = null;

  if (webhookNode) {
    const webhookPath = webhookNode.parameters.path;
    webhookUrl = `https://workflows.innovareai.com/webhook/${webhookPath}`;
    console.log('   Webhook URL:', webhookUrl);
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Open workflow in N8N:');
  console.log('   https://workflows.innovareai.com/workflow/' + workflow.id);
  console.log('\n2. Configure Supabase credentials:');
  console.log('   - Click any Supabase node (should show ⚠️ warning)');
  console.log('   - Click credential dropdown → "Create New Credential"');
  console.log('   - Enter:');
  console.log('     * URL: https://latxadqrvrrrcvkktrog.supabase.co');
  console.log('     * Service Role Key: (from SUPABASE_SERVICE_ROLE_KEY in .env.local)');
  console.log('   - Save and apply to all Supabase nodes');
  console.log('\n3. Activate the workflow:');
  console.log('   - Toggle "Inactive" → "Active" in top-right corner');
  console.log('\n4. Test enrichment:');
  console.log('   - Go to Data Collection Hub');
  console.log('   - Select 1 prospect with LinkedIn URL');
  console.log('   - Click "Enrich Selected"');
  console.log('   - Monitor execution: https://workflows.innovareai.com/executions');

  if (webhookUrl) {
    console.log('\n🔗 Webhook is configured at:');
    console.log('   ' + webhookUrl);
    console.log('   (already set in /api/prospects/enrich-async/route.ts)');
  }

  console.log('\n📚 Full guide: N8N_ENRICHMENT_IMPORT_GUIDE.md');
}

// Run import
importWorkflow().catch(console.error);
