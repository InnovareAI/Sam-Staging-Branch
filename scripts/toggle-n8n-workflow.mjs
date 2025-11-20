#!/usr/bin/env node

const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ';

console.log('Deactivating workflow...');
let response = await fetch(`https://workflows.innovareai.com/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ active: false })
});

console.log(`Deactivate: ${response.status}`);

await new Promise(resolve => setTimeout(resolve, 2000));

console.log('\nReactivating workflow...');
response = await fetch(`https://workflows.innovareai.com/api/v1/workflows/${WORKFLOW_ID}`, {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ active: true })
});

console.log(`Reactivate: ${response.status}`);

if (response.ok) {
  const result = await response.json();
  console.log('\n✅ Workflow reactivated successfully');
  console.log(`   Updated: ${result.updatedAt}`);
} else {
  console.error('❌ Failed to reactivate');
}
