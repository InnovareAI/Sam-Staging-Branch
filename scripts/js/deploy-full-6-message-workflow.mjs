#!/usr/bin/env node
/**
 * Deploy Complete 6-Message Workflow - PRODUCTION READY
 *
 * Features:
 * - Full sequence: CR + FU1 + FU2 + FU3 + FU4 + GB
 * - Connection acceptance check (CRITICAL - prevents messaging non-connections)
 * - Reply detection before each follow-up (prevents spamming engaged prospects)
 * - Automatic prospect status updates
 *
 * Workflow: CR → Check Accepted → Wait → Check Reply → FU1 → ... → GB
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY not found');
  process.exit(1);
}

async function makeN8NRequest(endpoint, method = 'GET', body = null) {
  const url = `${N8N_API_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`N8N API error ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

// Helper to create reply check node
const createReplyCheckNode = (id, name, position) => ({
  id,
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 3,
  position,
  parameters: {
    method: "GET",
    url: `={{ $env.UNIPILE_DSN }}/api/v1/messaging/messages?account_id={{ $json.unipile_account_id }}&attendees={{ $json.prospect.linkedin_url }}&limit=20`,
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth"
  }
});

// Helper to create IF node
const createIfReplyNode = (id, name, position) => ({
  id,
  name,
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  position,
  parameters: {
    conditions: {
      options: { caseSensitive: true },
      conditions: [{
        leftValue: "={{ $json.items?.filter(msg => msg.from !== $json.unipile_account_id && new Date(msg.date) > new Date($json.last_message_sent)).length }}",
        rightValue: "0",
        operator: { type: "number", operation: "larger" }
      }]
    }
  }
});

// Helper to create mark engaged node
const createMarkEngagedNode = (id, name, position, step) => ({
  id,
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 3,
  position,
  parameters: {
    method: "POST",
    url: `={{ $env.SAM_API_URL }}/api/webhooks/n8n/campaign-status`,
    sendBody: true,
    contentType: "json",
    body: JSON.stringify({
      campaign_id: "={{ $json.campaign_id }}",
      prospect_id: "={{ $json.prospect.id }}",
      status: "engaged",
      reply_detected: true,
      stopped_at_step: step
    })
  }
});

// Helper to create send message node
const createSendMessageNode = (id, name, position, messageKey) => ({
  id,
  name,
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 3,
  position,
  parameters: {
    method: "POST",
    url: `={{ $env.UNIPILE_DSN }}/api/v1/messaging/messages`,
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth",
    sendBody: true,
    contentType: "json",
    body: JSON.stringify({
      account_id: "={{ $json.unipile_account_id }}",
      attendees: [{ identifier: "={{ $json.prospect.linkedin_url }}" }],
      text: `={{ $json.messages.${messageKey} }}`,
      provider_id: "LINKEDIN"
    })
  }
});

const fullWorkflow = {
  name: "SAM Master Campaign Orchestrator",
  nodes: [
    // Initial nodes
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
        responseMode: "onReceived",
        options: { rawBody: false }
      }
    },
    {
      id: "workspace_router",
      name: "Workspace Router",
      type: "n8n-nodes-base.switch",
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        mode: "expression",
        expression: "={{ $json.workspace_id }}",
        fallbackOutput: 0
      }
    },
    {
      id: "template_selector",
      name: "Template Selector",
      type: "n8n-nodes-base.switch",
      typeVersion: 1,
      position: [650, 300],
      parameters: {
        mode: "expression",
        expression: "={{ $json.template || 'cr_4fu_1gb' }}",
        fallbackOutput: 0
      }
    },
    {
      id: "campaign_handler",
      name: "Campaign Handler",
      type: "n8n-nodes-base.function",
      typeVersion: 1,
      position: [850, 300],
      parameters: {
        functionCode: `
return {
  workspace_id: $input.item.json.workspace_id,
  campaign_id: $input.item.json.campaign_id,
  unipile_account_id: $input.item.json.unipile_account_id,
  prospects: $input.item.json.prospects || [],
  messages: $input.item.json.messages || {},
  timing: $input.item.json.timing || {
    fu1_delay_days: 2,
    fu2_delay_days: 5,
    fu3_delay_days: 7,
    fu4_delay_days: 5,
    gb_delay_days: 7
  },
  last_message_sent: new Date().toISOString()
};
`
      }
    },
    {
      id: "prospect_loop",
      name: "Process Each Prospect",
      type: "n8n-nodes-base.splitInBatches",
      typeVersion: 1,
      position: [1050, 300],
      parameters: { batchSize: 1, options: { reset: false } }
    },

    // CR
    createSendMessageNode("send_cr", "Send CR", [1250, 300], "cr"),

    // Connection Acceptance Check (CRITICAL - can't message until connected)
    {
      id: "check_connection_accepted",
      name: "Check Connection Accepted",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [1450, 300],
      parameters: {
        method: "GET",
        url: `={{ $env.UNIPILE_DSN }}/api/v1/users/{{ $json.prospect.linkedin_user_id }}?account_id={{ $json.unipile_account_id }}`,
        authentication: "genericCredentialType",
        genericAuthType: "httpHeaderAuth"
      }
    },
    {
      id: "if_connection_accepted",
      name: "Connection Accepted?",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: [1650, 300],
      parameters: {
        conditions: {
          options: { caseSensitive: true },
          conditions: [{
            leftValue: "={{ $json.is_connected }}",
            rightValue: "true",
            operator: { type: "boolean", operation: "equals" }
          }]
        }
      }
    },
    {
      id: "mark_not_connected",
      name: "Not Connected - Exit",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [1850, 200],
      parameters: {
        method: "POST",
        url: `={{ $env.SAM_API_URL }}/api/webhooks/n8n/campaign-status`,
        sendBody: true,
        contentType: "json",
        body: JSON.stringify({
          campaign_id: "={{ $json.campaign_id }}",
          prospect_id: "={{ $json.prospect.id }}",
          status: "connection_not_accepted",
          note: "Connection request not accepted - sequence stopped"
        })
      }
    },

    { id: "wait_fu1", name: "Wait for FU1", type: "n8n-nodes-base.wait", typeVersion: 1, position: [1850, 400], parameters: { amount: "={{ $json.timing.fu1_delay_days }}", unit: "days" } },

    // FU1 with reply check
    createReplyCheckNode("check_reply_fu1", "Check Reply (FU1)", [2050, 400]),
    createIfReplyNode("if_reply_fu1", "Reply? (FU1)", [2250, 400]),
    createMarkEngagedNode("mark_engaged_fu1", "Engaged (FU1)", [2450, 300], "fu1"),
    createSendMessageNode("send_fu1", "Send FU1", [2450, 500], "fu1"),
    { id: "wait_fu2", name: "Wait for FU2", type: "n8n-nodes-base.wait", typeVersion: 1, position: [2250, 400], parameters: { amount: "={{ $json.timing.fu2_delay_days }}", unit: "days" } },

    // FU2 with reply check
    createReplyCheckNode("check_reply_fu2", "Check Reply (FU2)", [2450, 400]),
    createIfReplyNode("if_reply_fu2", "Reply? (FU2)", [2650, 400]),
    createMarkEngagedNode("mark_engaged_fu2", "Engaged (FU2)", [2850, 300], "fu2"),
    createSendMessageNode("send_fu2", "Send FU2", [2850, 500], "fu2"),
    { id: "wait_fu3", name: "Wait for FU3", type: "n8n-nodes-base.wait", typeVersion: 1, position: [3050, 500], parameters: { amount: "={{ $json.timing.fu3_delay_days }}", unit: "days" } },

    // FU3 with reply check
    createReplyCheckNode("check_reply_fu3", "Check Reply (FU3)", [3250, 500]),
    createIfReplyNode("if_reply_fu3", "Reply? (FU3)", [3450, 500]),
    createMarkEngagedNode("mark_engaged_fu3", "Engaged (FU3)", [3650, 400], "fu3"),
    createSendMessageNode("send_fu3", "Send FU3", [3650, 600], "fu3"),
    { id: "wait_fu4", name: "Wait for FU4", type: "n8n-nodes-base.wait", typeVersion: 1, position: [3850, 600], parameters: { amount: "={{ $json.timing.fu4_delay_days }}", unit: "days" } },

    // FU4 with reply check
    createReplyCheckNode("check_reply_fu4", "Check Reply (FU4)", [4050, 600]),
    createIfReplyNode("if_reply_fu4", "Reply? (FU4)", [4250, 600]),
    createMarkEngagedNode("mark_engaged_fu4", "Engaged (FU4)", [4450, 500], "fu4"),
    createSendMessageNode("send_fu4", "Send FU4", [4450, 700], "fu4"),
    { id: "wait_gb", name: "Wait for GB", type: "n8n-nodes-base.wait", typeVersion: 1, position: [4650, 700], parameters: { amount: "={{ $json.timing.gb_delay_days }}", unit: "days" } },

    // GB (Goodbye) with reply check
    createReplyCheckNode("check_reply_gb", "Check Reply (GB)", [4850, 700]),
    createIfReplyNode("if_reply_gb", "Reply? (GB)", [5050, 700]),
    createMarkEngagedNode("mark_engaged_gb", "Engaged (GB)", [5250, 600], "gb"),
    createSendMessageNode("send_gb", "Send GB", [5250, 800], "gb"),

    // Final status update
    {
      id: "update_status",
      name: "Mark Complete",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 3,
      position: [5450, 800],
      parameters: {
        method: "POST",
        url: `={{ $env.SAM_API_URL }}/api/webhooks/n8n/campaign-status`,
        sendBody: true,
        contentType: "json",
        body: JSON.stringify({
          campaign_id: "={{ $json.campaign_id }}",
          prospect_id: "={{ $json.prospect.id }}",
          status: "completed",
          completed_at: "={{ $now.toISOString() }}"
        })
      }
    }
  ],

  connections: {
    webhook_trigger: { main: [[{ node: "workspace_router", type: "main", index: 0 }]] },
    workspace_router: { main: [[{ node: "template_selector", type: "main", index: 0 }]] },
    template_selector: { main: [[{ node: "campaign_handler", type: "main", index: 0 }]] },
    campaign_handler: { main: [[{ node: "prospect_loop", type: "main", index: 0 }]] },
    prospect_loop: { main: [[{ node: "send_cr", type: "main", index: 0 }]] },

    // CR → Check Acceptance → IF Accepted → Wait → Check Reply → IF
    send_cr: { main: [[{ node: "check_connection_accepted", type: "main", index: 0 }]] },
    check_connection_accepted: { main: [[{ node: "if_connection_accepted", type: "main", index: 0 }]] },
    if_connection_accepted: {
      main: [
        [{ node: "mark_not_connected", type: "main", index: 0 }],  // Not accepted = exit
        [{ node: "wait_fu1", type: "main", index: 0 }]             // Accepted = continue
      ]
    },
    wait_fu1: { main: [[{ node: "check_reply_fu1", type: "main", index: 0 }]] },
    check_reply_fu1: { main: [[{ node: "if_reply_fu1", type: "main", index: 0 }]] },
    if_reply_fu1: {
      main: [
        [{ node: "mark_engaged_fu1", type: "main", index: 0 }],  // Reply = exit
        [{ node: "send_fu1", type: "main", index: 0 }]            // No reply = send
      ]
    },

    // FU1 → Wait → Check → IF
    send_fu1: { main: [[{ node: "wait_fu2", type: "main", index: 0 }]] },
    wait_fu2: { main: [[{ node: "check_reply_fu2", type: "main", index: 0 }]] },
    check_reply_fu2: { main: [[{ node: "if_reply_fu2", type: "main", index: 0 }]] },
    if_reply_fu2: {
      main: [
        [{ node: "mark_engaged_fu2", type: "main", index: 0 }],
        [{ node: "send_fu2", type: "main", index: 0 }]
      ]
    },

    // FU2 → Wait → Check → IF
    send_fu2: { main: [[{ node: "wait_fu3", type: "main", index: 0 }]] },
    wait_fu3: { main: [[{ node: "check_reply_fu3", type: "main", index: 0 }]] },
    check_reply_fu3: { main: [[{ node: "if_reply_fu3", type: "main", index: 0 }]] },
    if_reply_fu3: {
      main: [
        [{ node: "mark_engaged_fu3", type: "main", index: 0 }],
        [{ node: "send_fu3", type: "main", index: 0 }]
      ]
    },

    // FU3 → Wait → Check → IF
    send_fu3: { main: [[{ node: "wait_fu4", type: "main", index: 0 }]] },
    wait_fu4: { main: [[{ node: "check_reply_fu4", type: "main", index: 0 }]] },
    check_reply_fu4: { main: [[{ node: "if_reply_fu4", type: "main", index: 0 }]] },
    if_reply_fu4: {
      main: [
        [{ node: "mark_engaged_fu4", type: "main", index: 0 }],
        [{ node: "send_fu4", type: "main", index: 0 }]
      ]
    },

    // FU4 → Wait → Check → IF
    send_fu4: { main: [[{ node: "wait_gb", type: "main", index: 0 }]] },
    wait_gb: { main: [[{ node: "check_reply_gb", type: "main", index: 0 }]] },
    check_reply_gb: { main: [[{ node: "if_reply_gb", type: "main", index: 0 }]] },
    if_reply_gb: {
      main: [
        [{ node: "mark_engaged_gb", type: "main", index: 0 }],
        [{ node: "send_gb", type: "main", index: 0 }]
      ]
    },

    // GB → Complete
    send_gb: { main: [[{ node: "update_status", type: "main", index: 0 }]] }
  },

  settings: {
    timezone: "America/New_York",
    saveManualExecutions: true,
    saveExecutionProgress: true,
    executionTimeout: 2592000 // 30 days
  }
};

console.log('🚀 Deploying complete 6-message workflow with stop-on-reply...\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', fullWorkflow);

  console.log('✅ COMPLETE 6-MESSAGE WORKFLOW DEPLOYED!\n');
  console.log('📋 Message Sequence:');
  console.log('   1. CR (Connection Request) - Day 0');
  console.log('      ↓ Check Connection Accepted');
  console.log('   2. FU1 - Day 2 (with reply check)');
  console.log('   3. FU2 - Day 7 (with reply check)');
  console.log('   4. FU3 - Day 14 (with reply check)');
  console.log('   5. FU4 - Day 19 (with reply check)');
  console.log('   6. GB (Goodbye) - Day 26 (with reply check)');
  console.log('\n🔐 Connection Acceptance Check:');
  console.log('   - Checks if prospect accepted connection BEFORE sending messages');
  console.log('   - Exits sequence if connection not accepted (prevents LinkedIn errors)');
  console.log('   - Protects account reputation and prevents wasted API calls');
  console.log('\n🛡️ Reply Detection:');
  console.log('   - Checks for prospect reply before EACH follow-up');
  console.log('   - Exits sequence immediately if reply detected');
  console.log('   - Marks prospect as "engaged" in SAM database');
  console.log('   - Prevents spamming prospects who responded');
  console.log('\n🎯 Ready to use!');

} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
