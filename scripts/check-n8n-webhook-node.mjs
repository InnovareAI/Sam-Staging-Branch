#!/usr/bin/env node

const response = await fetch('https://workflows.innovareai.com/api/v1/workflows/aVG6LC4ZFRMN7Bw6', {
  headers: {
    'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ'
  }
});

const workflow = await response.json();
const webhookNode = workflow.nodes.find(n => n.name === 'Update Status - CR Sent');

console.log('Current webhook node in N8N:');
console.log(JSON.stringify(webhookNode.parameters, null, 2));
