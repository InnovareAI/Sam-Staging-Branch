const fs = require('fs');
const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ';
const WORKFLOW_ID = 'pWxsl8D5irntaRwR';
const N8N_HOST = 'workflows.innovareai.com';

console.log('📤 Uploading workflow to N8N...\n');

const workflow = JSON.parse(fs.readFileSync('n8n-workflow-clean.json', 'utf8'));
const body = JSON.stringify(workflow);

const options = {
  hostname: N8N_HOST,
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`HTTP Status: ${res.statusCode}\n`);

    if (res.statusCode === 200) {
      console.log('✅ WORKFLOW UPDATED SUCCESSFULLY!');
      console.log('\n='.repeat(70));
      console.log('\n💡 The fix has been applied:');
      console.log('• Extract Campaign Data now gets unipileAccountId correctly');
      console.log('• Get LinkedIn Profile will receive the account_id parameter');
      console.log('• No more "Bad request" errors!');
      console.log('\n🧪 Test with a campaign execution to verify.\n');
    } else {
      console.log('❌ Update failed!');
      console.log('Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write(body);
req.end();
