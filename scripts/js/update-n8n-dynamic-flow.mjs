#!/usr/bin/env node
/**
 * Update N8N workflow to read dynamic flow_settings from webhook payload
 * Makes one workflow handle all campaigns with different timing
 */
import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA';
const WORKFLOW_ID = 'FNwzHH1WTHGMtdEe';
const N8N_BASE_URL = 'workflows.innovareai.com';

console.log('🔄 Fetching workflow...');

// First, get the current workflow
const getOptions = {
  hostname: N8N_BASE_URL,
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
};

const getReq = https.request(getOptions, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const workflow = JSON.parse(data);
      console.log('✅ Workflow retrieved');
      console.log(`   Nodes: ${workflow.nodes.length}`);

      // Update workflow to be data-driven
      updateWorkflowToDynamic(workflow);
    } else {
      console.error('❌ Failed to get workflow');
      console.error(`   Status: ${res.statusCode}`);
      console.error(`   Response: ${data}`);
    }
  });
});

getReq.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

getReq.end();

function updateWorkflowToDynamic(workflow) {
  console.log('\n🔧 Updating workflow to be data-driven...');

  let updateCount = 0;

  // Update all Wait nodes to read from flow_settings
  workflow.nodes.forEach(node => {
    if (node.type === 'n8n-nodes-base.wait') {
      if (node.name === 'Wait 24-48 Hours' || node.name.includes('Wait for FU')) {
        // This is the connection request wait node
        node.parameters = {
          unit: 'hours',
          amount: '={{$json.flow_settings.connection_wait_hours || 36}}'
        };
        console.log(`   ✅ Updated: ${node.name} → Read connection_wait_hours`);
        updateCount++;
      } else if (node.name.includes('Wait')) {
        // This is a follow-up wait node
        node.parameters = {
          unit: 'hours',
          amount: '={{($json.flow_settings.followup_wait_days || 5) * 24}}'
        };
        console.log(`   ✅ Updated: ${node.name} → Read followup_wait_days`);
        updateCount++;
      }
    }

    // Update all Personalize nodes to read messages from flow_settings
    if (node.type === 'n8n-nodes-base.code' && node.name.includes('Personalize')) {
      const messageKey = extractMessageKey(node.name);
      if (messageKey) {
        node.parameters.jsCode = generatePersonalizeCode(messageKey);
        console.log(`   ✅ Updated: ${node.name} → Read from flow_settings.messages.${messageKey}`);
        updateCount++;
      }
    }
  });

  console.log(`\n📊 Updated ${updateCount} nodes\n`);

  // Save the updated workflow
  saveWorkflow(workflow);
}

function extractMessageKey(nodeName) {
  if (nodeName.includes('Connection Request')) return 'connection_request';
  if (nodeName.includes('FU1')) return 'follow_up_1';
  if (nodeName.includes('FU2')) return 'follow_up_2';
  if (nodeName.includes('FU3')) return 'follow_up_3';
  if (nodeName.includes('FU4')) return 'follow_up_4';
  if (nodeName.includes('FU5')) return 'follow_up_5';
  if (nodeName.includes('FU6')) return 'follow_up_6';
  if (nodeName.includes('Goodbye')) return 'goodbye';
  return null;
}

function generatePersonalizeCode(messageKey) {
  return `// Personalize ${messageKey} message from flow_settings
const flowSettings = $input.first().json.flow_settings;
const prospect = $input.first().json;

// Get message from flow_settings
const message = flowSettings.messages.${messageKey};

// If no message configured, mark campaign as complete and stop
if (!message || message.trim() === '') {
  return {
    ...items[0].json,
    personalizedMessage: null,
    skipMessage: true,
    campaignComplete: true
  };
}

// Personalize the message
const personalized = message
  .replace(/{first_name}/gi, prospect.first_name || '')
  .replace(/{last_name}/gi, prospect.last_name || '')
  .replace(/{company_name}/gi, prospect.company_name || '')
  .replace(/{title}/gi, prospect.title || '');

return {
  ...items[0].json,
  personalizedMessage: personalized,
  skipMessage: false
};`;
}

function saveWorkflow(workflow) {
  console.log('💾 Saving updated workflow...\n');

  const cleanWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData
  };

  const payload = JSON.stringify(cleanWorkflow);

  const putOptions = {
    hostname: N8N_BASE_URL,
    path: `/api/v1/workflows/${WORKFLOW_ID}`,
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  const putReq = https.request(putOptions, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        const result = JSON.parse(data);
        console.log('✅ Workflow updated successfully!');
        console.log(`   Name: ${result.name}`);
        console.log(`   Active: ${result.active}`);
        console.log(`   Nodes: ${result.nodes.length}`);
        console.log('\n🎉 Workflow is now DATA-DRIVEN!');
        console.log('   • All campaigns use the same workflow');
        console.log('   • Wait times read from flow_settings');
        console.log('   • Messages read from flow_settings');
        console.log(`\n📝 View workflow:`);
        console.log(`   https://workflows.innovareai.com/workflow/${result.id}`);
      } else {
        console.error('❌ Update failed!');
        console.error(`   Status: ${res.statusCode}`);
        console.error(`   Response: ${data}`);
      }
    });
  });

  putReq.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  putReq.write(payload);
  putReq.end();
}
