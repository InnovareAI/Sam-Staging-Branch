#!/usr/bin/env node
/**
 * List all N8N workflows
 */

import 'dotenv/config';

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY not found in environment');
  process.exit(1);
}

async function makeN8NRequest(endpoint, method = 'GET') {
  const url = `${N8N_API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY,
    },
  };

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`N8N API error ${response.status}: ${errorText}`);
  }

  return await response.json();
}

async function listWorkflows() {
  console.log('📋 Listing N8N workflows...\n');

  try {
    const result = await makeN8NRequest('/workflows', 'GET');
    const workflows = result.data || result;

    console.log(`Found ${workflows.length} workflows:\n`);

    workflows.forEach((w, i) => {
      console.log(`${i + 1}. ${w.name}`);
      console.log(`   ID: ${w.id}`);
      console.log(`   Active: ${w.active ? '✅' : '❌'}`);
      console.log(`   Created: ${w.createdAt}`);
      console.log(`   Updated: ${w.updatedAt}`);
      console.log('');
    });

    // Find master workflow
    const master = workflows.find(w => w.name === 'SAM Master Campaign Orchestrator');
    if (master) {
      console.log('✅ Master Campaign Orchestrator found!');
      console.log('📝 Workflow ID:', master.id);
      console.log('📝 Active:', master.active ? 'Yes' : 'No');
      console.log('📝 Webhook URL: https://workflows.innovareai.com/webhook/campaign-execute');
    } else {
      console.log('⚠️  Master Campaign Orchestrator not found');
    }

  } catch (error) {
    console.error('❌ Failed to list workflows:', error.message);
    process.exit(1);
  }
}

listWorkflows().catch(console.error);
