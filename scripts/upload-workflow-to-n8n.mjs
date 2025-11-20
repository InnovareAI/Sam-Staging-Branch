#!/usr/bin/env node

import { readFileSync } from 'fs';

const workflow = JSON.parse(readFileSync('/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/temp/SAM-Master-Campaign-Orchestrator-CORRECTED.json', 'utf8'));

const response = await fetch('https://workflows.innovareai.com/api/v1/workflows/aVG6LC4ZFRMN7Bw6', {
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5Yzg4NDFiNy1kODhmLTRlYWMtYWZiOS03N2Y5ODlmYzk5MTYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMzE4MzU5fQ.ZlCEWESXrba8QESYWGCwE9IVczctJCflnF7iyf0OysQ',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(workflow)
});

if (response.ok) {
  const result = await response.json();
  console.log('✅ Workflow uploaded successfully!');
  console.log(`   ID: ${result.id}`);
  console.log(`   Updated: ${result.updatedAt}`);
} else {
  const error = await response.text();
  console.error(`❌ Upload failed: ${response.status}`);
  console.error(error);
}
