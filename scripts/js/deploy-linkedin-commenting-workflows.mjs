#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY required');
  process.exit(1);
}

async function makeRequest(endpoint, method = 'GET', body = null) {
  const res = await fetch(`${N8N_API_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_API_KEY },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`N8N error ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function deployWorkflow(name, path) {
  console.log(`\n🚀 Deploying: ${name}`);
  const data = JSON.parse(readFileSync(join(__dirname, path), 'utf-8'));
  const workflows = await makeRequest('/workflows');
  const existing = workflows.data?.find(w => w.name === data.name);

  const payload = {
    name: data.name,
    nodes: data.nodes,
    connections: data.connections,
    settings: { executionOrder: 'v1', saveManualExecutions: true, saveExecutionProgress: true, saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' }
  };

  if (existing) {
    await makeRequest(`/workflows/${existing.id}`, 'PUT', payload);
    console.log(`✅ Updated: ${existing.id}`);
    return existing.id;
  } else {
    const result = await makeRequest('/workflows', 'POST', payload);
    console.log(`✅ Created: ${result.id}`);
    return result.id;
  }
}

(async () => {
  const workflows = [
    ['Post Discovery', 'n8n-linkedin-commenting-discovery-workflow.json'],
    ['Comment Generator', 'n8n-linkedin-commenting-generator-workflow.json'],
    ['Comment Poster', 'n8n-linkedin-commenting-poster-workflow.json']
  ];

  for (const [name, path] of workflows) {
    const id = await deployWorkflow(name, path);
    console.log(`🔄 Activating ${id}...`);
    await makeRequest(`/workflows/${id}/activate`, 'POST');
  }

  console.log('\n✅ ALL WORKFLOWS DEPLOYED\n');
})();
