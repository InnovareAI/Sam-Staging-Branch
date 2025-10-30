#!/usr/bin/env node
import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA';
const WORKFLOW_ID = 'FNwzHH1WTHGMtdEe';
const N8N_BASE_URL = 'workflows.innovareai.com';

const options = {
  hostname: N8N_BASE_URL,
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Accept': 'application/json'
  }
};

console.log('🔍 Getting workflow...');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const workflow = JSON.parse(data);
      console.log('✅ Workflow retrieved');
      console.log(`   ID: ${workflow.id}`);
      console.log(`   Name: ${workflow.name}`);
      console.log(`   Active: ${workflow.active}`);
      console.log(`   Nodes: ${workflow.nodes.length}`);

      // Now activate it with PUT
      workflow.active = true;
      activateWorkflow(workflow);
    } else {
      console.error('❌ Failed to get workflow');
      console.error(`   Status: ${res.statusCode}`);
      console.error(`   Response: ${data}`);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.end();

function activateWorkflow(workflow) {
  console.log('\n🚀 Activating workflow...');

  // Strip out read-only fields that N8N API doesn't accept in PUT
  const cleanWorkflow = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData,
    active: true  // Activate it
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
        console.log('✅ Workflow activated successfully!');
        console.log(`   Name: ${result.name}`);
        console.log(`   Active: ${result.active}`);
        console.log(`   URL: https://workflows.innovareai.com/workflow/${result.id}`);
        console.log(`   Webhook: https://workflows.innovareai.com/webhook/sam-campaign-execute`);
      } else {
        console.error('❌ Activation failed!');
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
