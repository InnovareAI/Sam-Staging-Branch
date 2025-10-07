#!/usr/bin/env node
/**
 * Create Master N8N Workflow for Multi-Tenant Campaign Orchestration
 *
 * This script creates the master workflow that:
 * 1. Receives campaign execution requests via webhook
 * 2. Routes based on workspace_id and template
 * 3. Executes CR + 4FU + 1GB LinkedIn campaign sequences
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY not found in environment');
  process.exit(1);
}

async function makeN8NRequest(endpoint, method = 'GET', body = null) {
  const url = `${N8N_API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`N8N API error ${response.status}: ${errorText}`);
  }

  return await response.json();
}

/**
 * Master Workflow Definition
 * This workflow orchestrates all campaign executions across all workspaces
 */
const masterWorkflowDefinition = {
  name: "SAM Master Campaign Orchestrator",
  nodes: [
    // 1. Webhook Trigger - Entry point for all campaign executions
    {
      id: "webhook_trigger",
      name: "Campaign Execute Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [250, 300],
      webhookId: "campaign-execute",
      parameters: {
        path: "campaign-execute",
        httpMethod: "POST",
        responseMode: "lastNode",
        options: {
          rawBody: false
        }
      }
    },

    // 2. Workspace Router - Route to correct tenant configuration
    {
      id: "workspace_router",
      name: "Workspace Router",
      type: "n8n-nodes-base.switch",
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        mode: "expression",
        expression: "={{ $json.workspace_id }}",
        rules: {
          rules: [
            {
              value: "babdcab8-1a78-4b2f-913e-6e9fd9821009",
              output: 0
            }
          ]
        },
        fallbackOutput: 1
      }
    },

    // 3. Template Selector - Select campaign template
    {
      id: "template_selector",
      name: "Template Selector",
      type: "n8n-nodes-base.switch",
      typeVersion: 1,
      position: [650, 300],
      parameters: {
        mode: "expression",
        expression: "={{ $json.template || 'cr_4fu_1gb' }}",
        rules: {
          rules: [
            {
              value: "cr_4fu_1gb",
              output: 0
            },
            {
              value: "cr_2fu",
              output: 1
            },
            {
              value: "email_5touch",
              output: 2
            }
          ]
        },
        fallbackOutput: 0
      }
    },

    // 4. CR + 4FU + 1GB Template Handler
    {
      id: "cr_4fu_1gb_handler",
      name: "CR + 4FU + 1GB Handler",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [850, 200],
      parameters: {
        functionCode: `
// Extract campaign data
const campaignData = {
  workspace_id: $input.item.json.workspace_id,
  campaign_id: $input.item.json.campaign_id,
  linkedin_account_id: $input.item.json.linkedin_account_id,
  prospects: $input.item.json.prospects || [],
  messages: $input.item.json.messages || {},
  timing: $input.item.json.timing || {
    fu1_delay_days: 2,
    fu2_delay_days: 5,
    fu3_delay_days: 7,
    fu4_delay_days: 5,
    gb_delay_days: 7
  },
  options: $input.item.json.options || {
    stop_on_reply: true,
    skip_weekends: true,
    active_hours_only: true,
    timezone: 'America/New_York'
  }
};

// Log execution start
console.log('🚀 Starting CR + 4FU + 1GB campaign for', campaignData.prospects.length, 'prospects');
console.log('Workspace:', campaignData.workspace_id);
console.log('Campaign:', campaignData.campaign_id);

// Return campaign data for next nodes
return campaignData;
`
      }
    },

    // 5. Prospect Loop - Process each prospect individually
    {
      id: "prospect_loop",
      name: "Process Each Prospect",
      type: "n8n-nodes-base.splitInBatches",
      typeVersion: 1,
      position: [1050, 200],
      parameters: {
        batchSize: 1,
        options: {
          reset: false
        }
      }
    },

    // 6. Connection Request Node
    {
      id: "send_connection_request",
      name: "Send Connection Request (CR)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [1250, 200],
      parameters: {
        method: "POST",
        url: "={{ $env.UNIPILE_API_URL }}/messages/send",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        options: {
          timeout: 10000
        },
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "account_id",
              value: "={{ $json.linkedin_account_id }}"
            },
            {
              name: "recipients",
              value: "={{ [$json.prospect.linkedin_url] }}"
            },
            {
              name: "text",
              value: "={{ $json.messages.cr }}"
            },
            {
              name: "type",
              value: "CONNECTION_REQUEST"
            }
          ]
        }
      }
    },

    // 7. Wait for Connection (2 days)
    {
      id: "wait_for_fu1",
      name: "Wait 2 Days for FU1",
      type: "n8n-nodes-base.wait",
      typeVersion: 1,
      position: [1450, 200],
      parameters: {
        amount: "={{ $json.timing.fu1_delay_days }}",
        unit: "days"
      }
    },

    // 8. Send Follow-up 1
    {
      id: "send_fu1",
      name: "Send Follow-up 1 (FU1)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [1650, 200],
      parameters: {
        method: "POST",
        url: "={{ $env.UNIPILE_API_URL }}/messages/send",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "account_id",
              value: "={{ $json.linkedin_account_id }}"
            },
            {
              name: "recipients",
              value: "={{ [$json.prospect.linkedin_url] }}"
            },
            {
              name: "text",
              value: "={{ $json.messages.fu1 }}"
            },
            {
              name: "type",
              value: "MESSAGE"
            }
          ]
        }
      }
    },

    // 9. Wait for FU2 (5 days)
    {
      id: "wait_for_fu2",
      name: "Wait 5 Days for FU2",
      type: "n8n-nodes-base.wait",
      typeVersion: 1,
      position: [1850, 200],
      parameters: {
        amount: "={{ $json.timing.fu2_delay_days }}",
        unit: "days"
      }
    },

    // 10. Send Follow-up 2
    {
      id: "send_fu2",
      name: "Send Follow-up 2 (FU2)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [2050, 200],
      parameters: {
        method: "POST",
        url: "={{ $env.UNIPILE_API_URL }}/messages/send",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "account_id",
              value: "={{ $json.linkedin_account_id }}"
            },
            {
              name: "recipients",
              value: "={{ [$json.prospect.linkedin_url] }}"
            },
            {
              name: "text",
              value: "={{ $json.messages.fu2 }}"
            },
            {
              name: "type",
              value: "MESSAGE"
            }
          ]
        }
      }
    },

    // 11. Wait for FU3 (7 days)
    {
      id: "wait_for_fu3",
      name: "Wait 7 Days for FU3",
      type: "n8n-nodes-base.wait",
      typeVersion: 1,
      position: [2250, 200],
      parameters: {
        amount: "={{ $json.timing.fu3_delay_days }}",
        unit: "days"
      }
    },

    // 12. Send Follow-up 3
    {
      id: "send_fu3",
      name: "Send Follow-up 3 (FU3)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [2450, 200],
      parameters: {
        method: "POST",
        url: "={{ $env.UNIPILE_API_URL }}/messages/send",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "account_id",
              value: "={{ $json.linkedin_account_id }}"
            },
            {
              name: "recipients",
              value: "={{ [$json.prospect.linkedin_url] }}"
            },
            {
              name: "text",
              value: "={{ $json.messages.fu3 }}"
            },
            {
              name: "type",
              value: "MESSAGE"
            }
          ]
        }
      }
    },

    // 13. Wait for FU4 (5 days)
    {
      id: "wait_for_fu4",
      name: "Wait 5 Days for FU4",
      type: "n8n-nodes-base.wait",
      typeVersion: 1,
      position: [2650, 200],
      parameters: {
        amount: "={{ $json.timing.fu4_delay_days }}",
        unit: "days"
      }
    },

    // 14. Send Follow-up 4
    {
      id: "send_fu4",
      name: "Send Follow-up 4 (FU4)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [2850, 200],
      parameters: {
        method: "POST",
        url: "={{ $env.UNIPILE_API_URL }}/messages/send",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "account_id",
              value: "={{ $json.linkedin_account_id }}"
            },
            {
              name: "recipients",
              value: "={{ [$json.prospect.linkedin_url] }}"
            },
            {
              name: "text",
              value: "={{ $json.messages.fu4 }}"
            },
            {
              name: "type",
              value: "MESSAGE"
            }
          ]
        }
      }
    },

    // 15. Wait for GB (7 days)
    {
      id: "wait_for_gb",
      name: "Wait 7 Days for GB",
      type: "n8n-nodes-base.wait",
      typeVersion: 1,
      position: [3050, 200],
      parameters: {
        amount: "={{ $json.timing.gb_delay_days }}",
        unit: "days"
      }
    },

    // 16. Send Goodbye Message
    {
      id: "send_goodbye",
      name: "Send Goodbye (GB)",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [3250, 200],
      parameters: {
        method: "POST",
        url: "={{ $env.UNIPILE_API_URL }}/messages/send",
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth",
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "account_id",
              value: "={{ $json.linkedin_account_id }}"
            },
            {
              name: "recipients",
              value: "={{ [$json.prospect.linkedin_url] }}"
            },
            {
              name: "text",
              value: "={{ $json.messages.gb }}"
            },
            {
              name: "type",
              value: "MESSAGE"
            }
          ]
        }
      }
    },

    // 17. Update Campaign Status
    {
      id: "update_status",
      name: "Update Campaign Status",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [3450, 200],
      parameters: {
        method: "POST",
        url: "={{ $env.SAM_API_URL }}/api/campaign/update-status",
        sendBody: true,
        bodyParameters: {
          parameters: [
            {
              name: "campaign_id",
              value: "={{ $json.campaign_id }}"
            },
            {
              name: "prospect_id",
              value: "={{ $json.prospect.id }}"
            },
            {
              name: "status",
              value: "completed"
            },
            {
              name: "completed_at",
              value: "={{ $now.toISOString() }}"
            }
          ]
        }
      }
    },

    // 18. Error Handler
    {
      id: "error_handler",
      name: "Error Handler",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [1250, 400],
      parameters: {
        functionCode: `
// Log error details
console.error('❌ Campaign execution error:', $input.item.json);

// Return error info for notification
return {
  error: true,
  message: $input.item.json.error?.message || 'Unknown error',
  workspace_id: $input.item.json.workspace_id,
  campaign_id: $input.item.json.campaign_id,
  prospect_id: $input.item.json.prospect?.id,
  timestamp: new Date().toISOString()
};
`
      }
    }
  ],

  connections: {
    webhook_trigger: {
      main: [[{ node: "workspace_router", type: "main", index: 0 }]]
    },
    workspace_router: {
      main: [[{ node: "template_selector", type: "main", index: 0 }]]
    },
    template_selector: {
      main: [[{ node: "cr_4fu_1gb_handler", type: "main", index: 0 }]]
    },
    cr_4fu_1gb_handler: {
      main: [[{ node: "prospect_loop", type: "main", index: 0 }]]
    },
    prospect_loop: {
      main: [[{ node: "send_connection_request", type: "main", index: 0 }]]
    },
    send_connection_request: {
      main: [[{ node: "wait_for_fu1", type: "main", index: 0 }]]
    },
    wait_for_fu1: {
      main: [[{ node: "send_fu1", type: "main", index: 0 }]]
    },
    send_fu1: {
      main: [[{ node: "wait_for_fu2", type: "main", index: 0 }]]
    },
    wait_for_fu2: {
      main: [[{ node: "send_fu2", type: "main", index: 0 }]]
    },
    send_fu2: {
      main: [[{ node: "wait_for_fu3", type: "main", index: 0 }]]
    },
    wait_for_fu3: {
      main: [[{ node: "send_fu3", type: "main", index: 0 }]]
    },
    send_fu3: {
      main: [[{ node: "wait_for_fu4", type: "main", index: 0 }]]
    },
    wait_for_fu4: {
      main: [[{ node: "send_fu4", type: "main", index: 0 }]]
    },
    send_fu4: {
      main: [[{ node: "wait_for_gb", type: "main", index: 0 }]]
    },
    wait_for_gb: {
      main: [[{ node: "send_goodbye", type: "main", index: 0 }]]
    },
    send_goodbye: {
      main: [[{ node: "update_status", type: "main", index: 0 }]]
    }
  },

  settings: {
    timezone: "America/New_York",
    saveManualExecutions: true,
    saveExecutionProgress: true,
    executionTimeout: 86400 // 24 hours
  }
};

async function createMasterWorkflow() {
  console.log('🚀 Creating SAM Master Campaign Orchestrator...\n');

  try {
    // Check if workflow already exists
    console.log('📋 Checking for existing workflows...');
    const existingWorkflows = await makeN8NRequest('/workflows', 'GET');

    const existing = existingWorkflows.data?.find(w => w.name === masterWorkflowDefinition.name);

    if (existing) {
      console.log(`⚠️  Workflow already exists: ${existing.name} (ID: ${existing.id})`);
      console.log('🔄 Updating existing workflow...\n');

      // Update existing workflow
      const updated = await makeN8NRequest(`/workflows/${existing.id}`, 'PUT', masterWorkflowDefinition);

      console.log('✅ Master workflow updated successfully!');
      console.log('📝 Workflow ID:', existing.id);
      console.log('📝 Workflow Name:', masterWorkflowDefinition.name);
      console.log('📝 Webhook URL: https://workflows.innovareai.com/webhook/campaign-execute');

      return existing.id;
    }

    // Create new workflow
    console.log('📝 Creating new workflow...\n');
    const result = await makeN8NRequest('/workflows', 'POST', masterWorkflowDefinition);

    const workflowId = result.data?.id || result.id;

    console.log('✅ Master workflow created successfully!');
    console.log('📝 Workflow ID:', workflowId);
    console.log('📝 Workflow Name:', masterWorkflowDefinition.name);
    console.log('📝 Webhook URL: https://workflows.innovareai.com/webhook/campaign-execute');
    console.log('\n🎯 Next steps:');
    console.log('1. Activate the workflow in N8N UI');
    console.log('2. Configure Unipile API credentials');
    console.log('3. Test with sample campaign execution');
    console.log('4. Integrate with SAM campaign creation API');

    return workflowId;

  } catch (error) {
    console.error('❌ Failed to create master workflow:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the script
createMasterWorkflow().catch(console.error);
