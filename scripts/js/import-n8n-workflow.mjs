#!/usr/bin/env node
import fs from 'fs';
import https from 'https';

const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA';
const N8N_BASE_URL = 'workflows.innovareai.com';

// Read workflow file
const workflowPath = './n8n-workflows/sam-linkedin-campaign-v2.json';
const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

// Prepare payload - only include fields N8N API expects
const payload = {
  name: workflowData.name,
  nodes: workflowData.nodes,
  connections: workflowData.connections,
  settings: workflowData.settings || {},
  staticData: workflowData.staticData || null
};

const postData = JSON.stringify(payload);

const options = {
  hostname: N8N_BASE_URL,
  path: '/api/v1/workflows',
  method: 'POST',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Importing workflow to N8N...');
console.log(`   Workflow: ${payload.name}`);
console.log(`   Nodes: ${payload.nodes.length}`);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      const result = JSON.parse(data);
      const workflow = result.data || result; // Handle both formats
      console.log('✅ Workflow imported successfully!');
      console.log(`   Workflow ID: ${workflow.id}`);
      console.log(`   Name: ${workflow.name}`);
      console.log(`   Active: ${workflow.active}`);
      console.log(`\n📝 Next steps:`);
      console.log(`   1. Go to: https://workflows.innovareai.com/workflow/${workflow.id}`);
      console.log(`   2. Configure environment variables (UNIPILE_DSN, UNIPILE_API_KEY)`);
      console.log(`   3. Activate the workflow`);
      console.log(`   4. Test with 1 prospect`);
    } else {
      console.error('❌ Import failed!');
      console.error(`   Status: ${res.statusCode}`);
      console.error(`   Response: ${data}`);
      try {
        const error = JSON.parse(data);
        console.error(`   Error: ${error.message}`);
      } catch (e) {
        // Not JSON
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(postData);
req.end();
