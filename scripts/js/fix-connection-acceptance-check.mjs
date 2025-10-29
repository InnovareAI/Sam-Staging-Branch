#!/usr/bin/env node
/**
 * Add Connection Acceptance Check After CR
 * CRITICAL: Can't send LinkedIn messages until connection accepted
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
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_API_KEY },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    throw new Error(`N8N API error ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

// Get current workflow
const current = await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'GET');

// Find the wait_fu1 node and add connection check before it
const updatedNodes = [
  ...current.nodes,

  // New node: Check Connection Acceptance
  {
    id: "check_connection_accepted",
    name: "Check Connection Accepted",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 3,
    position: [1350, 300],
    parameters: {
      method: "GET",
      url: `={{ $env.UNIPILE_DSN }}/api/v1/users/{{ $json.prospect.linkedin_user_id }}?account_id={{ $json.unipile_account_id }}`,
      authentication: "genericCredentialType",
      genericAuthType: "httpHeaderAuth"
    }
  },

  // New node: IF Connection Accepted
  {
    id: "if_connection_accepted",
    name: "Connection Accepted?",
    type: "n8n-nodes-base.if",
    typeVersion: 2,
    position: [1550, 300],
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

  // New node: Mark as Not Connected
  {
    id: "mark_not_connected",
    name: "Mark as Not Connected",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 3,
    position: [1750, 200],
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
  }
];

// Update connections to insert connection check after CR
const updatedConnections = {
  ...current.connections,

  // CR → Check Connection
  send_cr: { main: [[{ node: "check_connection_accepted", type: "main", index: 0 }]] },

  // Check Connection → IF
  check_connection_accepted: { main: [[{ node: "if_connection_accepted", type: "main", index: 0 }]] },

  // IF → Not Connected OR Wait for FU1
  if_connection_accepted: {
    main: [
      [{ node: "mark_not_connected", type: "main", index: 0 }],  // Not accepted = exit
      [{ node: "wait_fu1", type: "main", index: 0 }]             // Accepted = continue
    ]
  }
};

const updatedWorkflow = {
  ...current,
  nodes: updatedNodes,
  connections: updatedConnections
};

console.log('🔄 Adding connection acceptance check after CR...\n');

try {
  await makeN8NRequest(`/workflows/${WORKFLOW_ID}`, 'PUT', updatedWorkflow);

  console.log('✅ CONNECTION ACCEPTANCE CHECK ADDED!\n');
  console.log('📋 Updated Flow:');
  console.log('   1. Send CR (Connection Request)');
  console.log('   2. Check if connection accepted');
  console.log('   3. IF NOT ACCEPTED → Exit (mark as "connection_not_accepted")');
  console.log('   4. IF ACCEPTED → Continue to follow-ups');
  console.log('\n⚠️  CRITICAL FIX:');
  console.log('   - Cannot send LinkedIn messages until connected');
  console.log('   - Prevents message failures from unaccepted requests');
  console.log('   - Saves LinkedIn account reputation');
  console.log('\n🎯 Ready for testing!');

} catch (error) {
  console.error('❌ Update failed:', error.message);
  process.exit(1);
}
