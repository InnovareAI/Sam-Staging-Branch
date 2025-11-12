#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_API_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('🔍 Finding the CORRECT Campaign Workflow\n');

// Get all workflows
const response = await fetch(`${N8N_API_URL}/workflows`, {
  headers: { 'X-N8N-API-KEY': N8N_API_KEY }
});

const result = await response.json();
const workflows = result.data || result;

// Filter active campaign workflows
const activeCampaignWorkflows = workflows.filter(w =>
  w.active && w.name.toLowerCase().includes('campaign')
);

console.log(`Found ${activeCampaignWorkflows.length} active campaign workflows:\n`);

// Get details for each
for (const wf of activeCampaignWorkflows) {
  console.log(`📋 ${wf.name}`);
  console.log(`   ID: ${wf.id}`);

  // Get full workflow to check webhook path
  const detailResponse = await fetch(`${N8N_API_URL}/workflows/${wf.id}`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  const detail = await detailResponse.json();
  const webhookNode = detail.nodes?.find(n => n.type === 'n8n-nodes-base.webhook');

  if (webhookNode) {
    const webhookPath = webhookNode.parameters.path;
    console.log(`   Webhook: /webhook/${webhookPath}`);

    if (webhookPath === 'campaign-execute') {
      console.log(`   ⭐ THIS IS THE ONE SAM IS CALLING`);
    }
  } else {
    console.log(`   Webhook: None (polling/cron workflow)`);
  }

  // Check recent executions
  const execResponse = await fetch(`${N8N_API_URL}/executions?workflowId=${wf.id}&limit=3`, {
    headers: { 'X-N8N-API-KEY': N8N_API_KEY }
  });

  const execResult = await execResponse.json();
  const executions = execResult.data || execResult;

  if (executions.length > 0) {
    console.log(`   Recent executions:`);
    executions.forEach(e => {
      console.log(`      - ${e.status}: ${new Date(e.startedAt).toLocaleString()}`);
    });
  } else {
    console.log(`   Recent executions: None`);
  }

  console.log('');
}
