#!/usr/bin/env node
import https from 'https';

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU3MzQwOTUxfQ.7S2xKhsPYDuv7vFXfquwabQwT90SqteFVNzJ7jk1IaA';
const WORKFLOW_ID = 'FNwzHH1WTHGMtdEe';
const N8N_BASE_URL = 'workflows.innovareai.com';

// Activate the workflow
const payload = JSON.stringify({ active: true });

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

console.log('🚀 Activating N8N workflow...');
console.log(`   Workflow ID: ${WORKFLOW_ID}`);

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      const result = JSON.parse(data);
      console.log('✅ Workflow activated successfully!');
      console.log(`   Workflow: ${result.name}`);
      console.log(`   Active: ${result.active}`);
      console.log(`   Webhook URL: https://workflows.innovareai.com/webhook/sam-campaign-execute`);
      console.log('\n📝 Next steps:');
      console.log('   1. Verify environment variables are set in N8N (UNIPILE_DSN, UNIPILE_API_KEY)');
      console.log('   2. Test with 1 prospect');
      console.log('   3. Monitor N8N executions');
    } else {
      console.error('❌ Activation failed!');
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
