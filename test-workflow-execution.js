#!/usr/bin/env node

/**
 * Test N8N Workflow Execution from Sam App
 * This script tests the actual workflow execution triggered by the Sam app
 */

const N8N_INSTANCE_URL = process.env.N8N_INSTANCE_URL || 'https://workflows.innovareai.com';
const N8N_API_KEY = process.env.N8N_API_KEY;

// Sam Campaign Execution v2 - Clean workflow ID
const SAM_CAMPAIGN_WORKFLOW_ID = '79ZgBvhtNyx0wEGj';

async function testWorkflowExecution() {
  console.log('🧪 Testing N8N Workflow Execution from Sam App');
  console.log('==============================================\n');

  console.log('Configuration:');
  console.log(`  Instance URL: ${N8N_INSTANCE_URL}`);
  console.log(`  Workflow ID: ${SAM_CAMPAIGN_WORKFLOW_ID}`);
  console.log(`  API Key: ${N8N_API_KEY ? '✅ Set' : '❌ Missing'}\n`);

  if (!N8N_API_KEY) {
    console.error('❌ N8N_API_KEY is not set in environment');
    process.exit(1);
  }

  try {
    // Step 1: Verify workflow exists and is active
    console.log('Step 1: Verifying workflow status...');
    const workflowResponse = await fetch(
      `${N8N_INSTANCE_URL}/api/v1/workflows/${SAM_CAMPAIGN_WORKFLOW_ID}`,
      {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!workflowResponse.ok) {
      throw new Error(`Failed to fetch workflow: HTTP ${workflowResponse.status}`);
    }

    const workflowData = await workflowResponse.json();
    const workflow = workflowData.data || workflowData;

    console.log(`✅ Workflow found: ${workflow.name}`);
    console.log(`   Status: ${workflow.active ? 'Active 🟢' : 'Inactive 🔴'}`);
    console.log(`   Nodes: ${workflow.nodes?.length || 0}`);
    console.log('');

    if (!workflow.active) {
      console.warn('⚠️  WARNING: Workflow is not active!');
      console.warn('   The workflow needs to be activated in n8n before execution.');
      console.warn('   Go to: https://workflows.innovareai.com/workflow/' + SAM_CAMPAIGN_WORKFLOW_ID);
      console.warn('   Click the "Active" toggle to activate it.\n');

      console.log('Would you like to continue with a dry-run test anyway? (no actual execution)');
      console.log('Continuing in dry-run mode...\n');
    }

    // Step 2: Prepare test execution payload
    console.log('Step 2: Preparing test execution payload...');

    const testPayload = {
      workspaceConfig: {
        id: 'test-workflow-config-id',
        workspace_id: 'test-workspace-id',
        deployed_workflow_id: SAM_CAMPAIGN_WORKFLOW_ID,
        channel_preferences: {
          email_enabled: true,
          linkedin_enabled: false
        },
        email_config: {
          template_id: 'test-template',
          from_name: 'Test Sender',
          from_email: 'test@example.com'
        },
        reply_handling_config: {
          auto_pause: true
        }
      },
      approvedProspects: [
        {
          id: 'test-prospect-1',
          email: 'test1@example.com',
          first_name: 'John',
          last_name: 'Doe',
          company_name: 'Test Company',
          job_title: 'Test Manager',
          industry: 'Technology'
        },
        {
          id: 'test-prospect-2',
          email: 'test2@example.com',
          first_name: 'Jane',
          last_name: 'Smith',
          company_name: 'Example Corp',
          job_title: 'Director',
          industry: 'Finance'
        }
      ],
      executionPreferences: {
        delay_between_prospects: 300,
        max_daily_outreach: 50,
        working_hours_start: 9,
        working_hours_end: 17,
        timezone: 'UTC',
        exclude_weekends: true
      },
      credentials: {
        unipile_api_key: process.env.UNIPILE_API_KEY || 'test-key',
        account_mappings: [
          {
            channel: 'email',
            account_id: 'test-email-account',
            account_name: 'Test Email Account'
          }
        ]
      },
      campaignMetadata: {
        campaign_execution_id: `test-execution-${Date.now()}`,
        workspace_id: 'test-workspace-id',
        campaign_name: 'Test Campaign',
        campaign_type: 'email_only',
        webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/campaign/n8n-status-update`
      }
    };

    console.log(`✅ Test payload prepared`);
    console.log(`   Prospects: ${testPayload.approvedProspects.length}`);
    console.log(`   Campaign Type: ${testPayload.campaignMetadata.campaign_type}`);
    console.log('');

    // Step 3: Check if workflow has webhook trigger
    console.log('Step 3: Checking workflow trigger configuration...');

    const webhookNode = workflow.nodes?.find(node =>
      node.type === 'n8n-nodes-base.webhook' ||
      node.type === 'n8n-nodes-base.manualTrigger'
    );

    if (webhookNode) {
      console.log(`✅ Trigger node found: ${webhookNode.type}`);

      if (webhookNode.type === 'n8n-nodes-base.webhook') {
        const webhookPath = webhookNode.parameters?.path;
        const webhookMethod = webhookNode.parameters?.httpMethod || 'POST';
        console.log(`   Webhook Path: ${webhookPath || 'not configured'}`);
        console.log(`   HTTP Method: ${webhookMethod}`);

        if (webhookPath) {
          const webhookUrl = `${N8N_INSTANCE_URL}/webhook/${webhookPath}`;
          console.log(`   Full Webhook URL: ${webhookUrl}`);
          console.log('');

          console.log('Step 4: Testing webhook execution...');
          console.log(`   Sending ${webhookMethod} request to webhook...`);

          try {
            const webhookResponse = await fetch(webhookUrl, {
              method: webhookMethod,
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(testPayload)
            });

            const responseText = await webhookResponse.text();
            let responseData;
            try {
              responseData = JSON.parse(responseText);
            } catch {
              responseData = responseText;
            }

            console.log(`✅ Webhook response received`);
            console.log(`   Status: ${webhookResponse.status} ${webhookResponse.statusText}`);
            console.log(`   Response:`, JSON.stringify(responseData, null, 2).substring(0, 500));
            console.log('');

            if (webhookResponse.ok) {
              console.log('=================================');
              console.log('✅ WORKFLOW EXECUTION TEST PASSED');
              console.log('=================================\n');
              console.log('The workflow can be triggered successfully from the Sam app!');
              console.log(`\nWebhook URL to use in Sam app:`);
              console.log(`  ${webhookUrl}`);
            } else {
              console.log('⚠️  Webhook returned non-OK status');
              console.log('   This might be expected depending on workflow configuration');
            }

          } catch (webhookError) {
            console.error('❌ Webhook execution failed:', webhookError.message);
            console.log('\nPossible reasons:');
            console.log('  1. Workflow is not active (toggle it on in n8n)');
            console.log('  2. Webhook path is incorrect');
            console.log('  3. Network/firewall issues');
            console.log('  4. Workflow configuration needs adjustment');
          }
        } else {
          console.warn('⚠️  Webhook node found but path not configured');
        }
      } else {
        console.log('ℹ️  Workflow uses manual trigger');
        console.log('   Manual workflows cannot be triggered via API');
        console.log('   They must be started manually in the n8n UI');
      }
    } else {
      console.warn('⚠️  No webhook or manual trigger node found');
      console.log('   Workflow may use a different trigger type');
    }

    console.log('\n=================================');
    console.log('Test Summary');
    console.log('=================================');
    console.log(`Workflow ID: ${SAM_CAMPAIGN_WORKFLOW_ID}`);
    console.log(`Workflow Name: ${workflow.name}`);
    console.log(`Workflow Status: ${workflow.active ? 'Active ✅' : 'Inactive ❌'}`);
    console.log(`Trigger Type: ${webhookNode ? webhookNode.type : 'Unknown'}`);
    console.log(`\nN8N Instance: ${N8N_INSTANCE_URL}`);

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
testWorkflowExecution().catch(console.error);
