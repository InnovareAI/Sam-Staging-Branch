#!/usr/bin/env node
/**
 * Add Follow-Ups 2-6 to N8N Workflow
 *
 * This script extends the existing workflow to include:
 * - Follow-Up 2 (3-7 days after FU1)
 * - Follow-Up 3 (3-7 days after FU2)
 * - Follow-Up 4 (3-7 days after FU3)
 * - Follow-Up 5 (3-7 days after FU4)
 * - Follow-Up 6 (3-7 days after FU5)
 * - Goodbye message (final touchpoint)
 */

import https from 'https';
import fs from 'fs';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA';
const WORKFLOW_ID = 'FNwzHH1WTHGMtdEe';
const N8N_BASE_URL = 'workflows.innovareai.com';

console.log('🚀 Adding Follow-Ups 2-6 to N8N workflow...\n');

// Get current workflow
getWorkflow((workflow) => {
  console.log('✅ Retrieved current workflow');
  console.log(`   Current nodes: ${workflow.nodes.length}\n`);

  // Add follow-up nodes
  const updatedWorkflow = addFollowUpNodes(workflow);

  console.log(`✅ Added follow-up nodes`);
  console.log(`   New total nodes: ${updatedWorkflow.nodes.length}\n`);

  // Update workflow
  updateWorkflow(updatedWorkflow);
});

function getWorkflow(callback) {
  const options = {
    hostname: N8N_BASE_URL,
    path: `/api/v1/workflows/${WORKFLOW_ID}`,
    method: 'GET',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Accept': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        callback(JSON.parse(data));
      } else {
        console.error('❌ Failed to get workflow');
        console.error(`   Status: ${res.statusCode}`);
        process.exit(1);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
    process.exit(1);
  });

  req.end();
}

function addFollowUpNodes(workflow) {
  const followUps = [
    { num: 2, yPos: 300, waitDays: 5 },
    { num: 3, yPos: 450, waitDays: 5 },
    { num: 4, yPos: 600, waitDays: 7 },
    { num: 5, yPos: 750, waitDays: 7 },
    { num: 6, yPos: 900, waitDays: 7 }
  ];

  let xPos = 3100; // Start after FU1 nodes

  followUps.forEach((fu) => {
    // Wait node
    workflow.nodes.push({
      parameters: {
        amount: `={{Math.floor(Math.random() * 2) + ${fu.waitDays}}}`,
        unit: "days"
      },
      id: `wait-fu${fu.num}`,
      name: `Wait for FU${fu.num}`,
      type: "n8n-nodes-base.wait",
      typeVersion: 1,
      position: [xPos, fu.yPos],
      webhookId: `wait-fu${fu.num}`
    });

    // Personalize message node
    workflow.nodes.push({
      parameters: {
        functionCode: `// Personalize follow-up ${fu.num} message
const message = $input.first().json.messages.follow_up_${fu.num};
const prospect = $input.first().json;

// If no message configured, mark campaign as complete and stop
if (!message || message.trim() === '') {
  return {
    ...items[0].json,
    followUpMessage: null,
    skipMessage: true,
    campaignComplete: true
  };
}

const personalized = message
  .replace(/\\{first_name\\}/gi, prospect.first_name || '')
  .replace(/\\{last_name\\}/gi, prospect.last_name || '')
  .replace(/\\{company_name\\}/gi, prospect.company_name || '')
  .replace(/\\{title\\}/gi, prospect.title || '');

return {
  ...items[0].json,
  followUpMessage: personalized,
  skipMessage: false
};`
      },
      id: `personalize-fu${fu.num}`,
      name: `Personalize FU${fu.num}`,
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [xPos + 220, fu.yPos]
    });

    // IF node to check if message should be skipped
    workflow.nodes.push({
      parameters: {
        conditions: {
          boolean: [
            {
              value1: "={{$json.skipMessage}}",
              value2: false
            }
          ]
        }
      },
      id: `check-fu${fu.num}-message`,
      name: `FU${fu.num} Configured?`,
      type: "n8n-nodes-base.if",
      typeVersion: 1,
      position: [xPos + 440, fu.yPos]
    });

    // Send message node
    workflow.nodes.push({
      parameters: {
        method: "POST",
        url: "=https://{{$env.UNIPILE_DSN}}/api/v1/messaging/messages",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "X-API-KEY",
              value: "={{$env.UNIPILE_API_KEY}}"
            },
            {
              name: "Content-Type",
              value: "application/json"
            }
          ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "account_id": "{{$json.unipileAccountId}}",
  "provider_id": "{{$json.provider_id}}",
  "text": "{{$json.followUpMessage}}"
}`,
        options: {}
      },
      id: `send-fu${fu.num}`,
      name: `Send Follow-Up ${fu.num}`,
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4,
      position: [xPos + 660, fu.yPos - 150]
    });

    // Update status node (after successful send)
    workflow.nodes.push({
      parameters: {
        method: "POST",
        url: "=https://app.meet-sam.com/api/campaigns/update-prospect-status/{{$json.id}}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "status": "follow_up_${fu.num}_sent",
  "personalization_data": {
    "follow_up_${fu.num}_sent_at": "{{new Date().toISOString()}}"
  }
}`,
        options: {}
      },
      id: `update-fu${fu.num}-status`,
      name: `Update FU${fu.num} Status`,
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4,
      position: [xPos + 880, fu.yPos - 150]
    });

    // End campaign node (if message not configured)
    workflow.nodes.push({
      parameters: {
        method: "POST",
        url: "=https://app.meet-sam.com/api/campaigns/update-prospect-status/{{$json.id}}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "status": "campaign_completed",
  "personalization_data": {
    "completed_at": "{{new Date().toISOString()}}",
    "completed_at_step": "follow_up_${fu.num}",
    "reason": "No more messages configured"
  }
}`,
        options: {}
      },
      id: `end-at-fu${fu.num}`,
      name: `End Campaign (No FU${fu.num})`,
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4,
      position: [xPos + 660, fu.yPos + 150]
    });
  });

  // Add final goodbye message
  const xPosGoodbye = xPos + 880;
  workflow.nodes.push({
    parameters: {
      amount: "=7",
      unit: "days"
    },
    id: "wait-goodbye",
    name: "Wait 7 Days",
    type: "n8n-nodes-base.wait",
    typeVersion: 1,
    position: [xPosGoodbye, 1050],
    webhookId: "wait-goodbye"
  });

  workflow.nodes.push({
    parameters: {
      functionCode: `// Personalize goodbye message
const message = $input.first().json.messages.goodbye;
const prospect = $input.first().json;

if (!message) {
  throw new Error('No goodbye message configured');
}

const personalized = message
  .replace(/\\{first_name\\}/gi, prospect.first_name || '')
  .replace(/\\{last_name\\}/gi, prospect.last_name || '')
  .replace(/\\{company_name\\}/gi, prospect.company_name || '')
  .replace(/\\{title\\}/gi, prospect.title || '');

return {
  ...items[0].json,
  goodbyeMessage: personalized
};`
    },
    id: "personalize-goodbye",
    name: "Personalize Goodbye",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [xPosGoodbye + 220, 1050]
  });

  workflow.nodes.push({
    parameters: {
      method: "POST",
      url: "=https://{{$env.UNIPILE_DSN}}/api/v1/messaging/messages",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          {
            name: "X-API-KEY",
            value: "={{$env.UNIPILE_API_KEY}}"
          },
          {
            name: "Content-Type",
            value: "application/json"
          }
        ]
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody: `={
  "account_id": "{{$json.unipileAccountId}}",
  "provider_id": "{{$json.provider_id}}",
  "text": "{{$json.goodbyeMessage}}"
}`,
      options: {}
    },
    id: "send-goodbye",
    name: "Send Goodbye",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4,
    position: [xPosGoodbye + 440, 1050]
  });

  workflow.nodes.push({
    parameters: {
      method: "POST",
      url: "=https://app.meet-sam.com/api/campaigns/update-prospect-status/{{$json.id}}",
      sendBody: true,
      specifyBody: "json",
      jsonBody: `={
  "status": "campaign_completed",
  "personalization_data": {
    "goodbye_sent_at": "{{new Date().toISOString()}}"
  }
}`,
      options: {}
    },
    id: "update-goodbye-status",
    name: "Mark Campaign Complete",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4,
    position: [xPosGoodbye + 660, 1050]
  });

  // Update connections - chain all follow-ups with IF checks
  workflow.connections["Update FU1 Status"] = {
    main: [[{ node: "Wait for FU2", type: "main", index: 0 }]]
  };

  // FU2 Flow
  workflow.connections["Wait for FU2"] = { main: [[{ node: "Personalize FU2", type: "main", index: 0 }]] };
  workflow.connections["Personalize FU2"] = { main: [[{ node: "FU2 Configured?", type: "main", index: 0 }]] };
  workflow.connections["FU2 Configured?"] = {
    main: [
      [{ node: "Send Follow-Up 2", type: "main", index: 0 }],  // True
      [{ node: "End Campaign (No FU2)", type: "main", index: 0 }]   // False
    ]
  };
  workflow.connections["Send Follow-Up 2"] = { main: [[{ node: "Update FU2 Status", type: "main", index: 0 }]] };
  workflow.connections["Update FU2 Status"] = { main: [[{ node: "Wait for FU3", type: "main", index: 0 }]] };

  // FU3 Flow
  workflow.connections["Wait for FU3"] = { main: [[{ node: "Personalize FU3", type: "main", index: 0 }]] };
  workflow.connections["Personalize FU3"] = { main: [[{ node: "FU3 Configured?", type: "main", index: 0 }]] };
  workflow.connections["FU3 Configured?"] = {
    main: [
      [{ node: "Send Follow-Up 3", type: "main", index: 0 }],
      [{ node: "End Campaign (No FU3)", type: "main", index: 0 }]
    ]
  };
  workflow.connections["Send Follow-Up 3"] = { main: [[{ node: "Update FU3 Status", type: "main", index: 0 }]] };
  workflow.connections["Update FU3 Status"] = { main: [[{ node: "Wait for FU4", type: "main", index: 0 }]] };

  // FU4 Flow
  workflow.connections["Wait for FU4"] = { main: [[{ node: "Personalize FU4", type: "main", index: 0 }]] };
  workflow.connections["Personalize FU4"] = { main: [[{ node: "FU4 Configured?", type: "main", index: 0 }]] };
  workflow.connections["FU4 Configured?"] = {
    main: [
      [{ node: "Send Follow-Up 4", type: "main", index: 0 }],
      [{ node: "End Campaign (No FU4)", type: "main", index: 0 }]
    ]
  };
  workflow.connections["Send Follow-Up 4"] = { main: [[{ node: "Update FU4 Status", type: "main", index: 0 }]] };
  workflow.connections["Update FU4 Status"] = { main: [[{ node: "Wait for FU5", type: "main", index: 0 }]] };

  // FU5 Flow
  workflow.connections["Wait for FU5"] = { main: [[{ node: "Personalize FU5", type: "main", index: 0 }]] };
  workflow.connections["Personalize FU5"] = { main: [[{ node: "FU5 Configured?", type: "main", index: 0 }]] };
  workflow.connections["FU5 Configured?"] = {
    main: [
      [{ node: "Send Follow-Up 5", type: "main", index: 0 }],
      [{ node: "End Campaign (No FU5)", type: "main", index: 0 }]
    ]
  };
  workflow.connections["Send Follow-Up 5"] = { main: [[{ node: "Update FU5 Status", type: "main", index: 0 }]] };
  workflow.connections["Update FU5 Status"] = { main: [[{ node: "Wait for FU6", type: "main", index: 0 }]] };

  // FU6 Flow
  workflow.connections["Wait for FU6"] = { main: [[{ node: "Personalize FU6", type: "main", index: 0 }]] };
  workflow.connections["Personalize FU6"] = { main: [[{ node: "FU6 Configured?", type: "main", index: 0 }]] };
  workflow.connections["FU6 Configured?"] = {
    main: [
      [{ node: "Send Follow-Up 6", type: "main", index: 0 }],
      [{ node: "End Campaign (No FU6)", type: "main", index: 0 }]
    ]
  };
  workflow.connections["Send Follow-Up 6"] = { main: [[{ node: "Update FU6 Status", type: "main", index: 0 }]] };
  workflow.connections["Update FU6 Status"] = { main: [[{ node: "Wait 7 Days", type: "main", index: 0 }]] };

  // Goodbye Flow
  workflow.connections["Wait 7 Days"] = { main: [[{ node: "Personalize Goodbye", type: "main", index: 0 }]] };
  workflow.connections["Personalize Goodbye"] = { main: [[{ node: "Send Goodbye", type: "main", index: 0 }]] };
  workflow.connections["Send Goodbye"] = { main: [[{ node: "Mark Campaign Complete", type: "main", index: 0 }]] };

  return workflow;
}

function updateWorkflow(workflow) {
  const cleanWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  const payload = JSON.stringify(cleanWorkflow);

  const options = {
    hostname: N8N_BASE_URL,
    path: `/api/v1/workflows/${WORKFLOW_ID}`,
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  console.log('🔄 Updating workflow in N8N...\n');

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode === 200) {
        const result = JSON.parse(data);
        console.log('✅ Workflow updated successfully!');
        console.log(`   Total nodes: ${result.nodes.length}`);
        console.log(`   Follow-ups: FU1, FU2, FU3, FU4, FU5, FU6, Goodbye`);
        console.log(`\n📝 View workflow:`);
        console.log(`   https://workflows.innovareai.com/workflow/${WORKFLOW_ID}`);
      } else {
        console.error('❌ Update failed!');
        console.error(`   Status: ${res.statusCode}`);
        console.error(`   Response: ${data}`);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  req.write(payload);
  req.end();
}
