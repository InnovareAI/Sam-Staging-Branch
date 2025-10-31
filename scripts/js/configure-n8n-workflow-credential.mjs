#!/usr/bin/env node
/**
 * Configure N8N Workflow with Supabase Credential
 * Uses N8N REST API to update workflow nodes with proper credential
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'https://workflows.innovareai.com';
const N8N_API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_ID = 'aVG6LC4ZFRMN7Bw6';

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY not found in environment variables');
  process.exit(1);
}

async function n8nApi(endpoint, method = 'GET', body = null) {
  const url = `${N8N_BASE_URL}/api/v1${endpoint}`;
  const options = {
    method,
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`N8N API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function main() {
  console.log('🔧 N8N Workflow Credential Configuration\n');
  console.log('='.repeat(60));

  try {
    // Step 1: List credentials to find Supabase credential
    console.log('\n📋 STEP 1: Finding Supabase Credential');
    console.log('-'.repeat(60));

    const credentials = await n8nApi('/credentials');
    console.log(`   Total credentials: ${credentials.data?.length || 0}`);

    const supabaseCred = credentials.data?.find(c =>
      c.name?.toLowerCase().includes('supabase') ||
      c.name === 'Supabase API Auth'
    );

    if (!supabaseCred) {
      console.error('\n❌ Supabase credential not found!');
      console.error('   Available credentials:');
      credentials.data?.forEach(c => {
        console.error(`   - ${c.name} (${c.type})`);
      });
      process.exit(1);
    }

    console.log(`   ✅ Found: "${supabaseCred.name}"`);
    console.log(`   Type: ${supabaseCred.type}`);
    console.log(`   ID: ${supabaseCred.id}`);

    // Step 2: Get current workflow
    console.log('\n📥 STEP 2: Loading Workflow');
    console.log('-'.repeat(60));

    const workflow = await n8nApi(`/workflows/${WORKFLOW_ID}`);
    console.log(`   Workflow: ${workflow.name}`);
    console.log(`   Nodes: ${workflow.nodes.length}`);
    console.log(`   Active: ${workflow.active ? 'Yes' : 'No'}`);

    // Step 3: Find "Update Database" node
    const updateDbNode = workflow.nodes.find(n => n.name === 'Update Database');

    if (!updateDbNode) {
      console.error('\n❌ "Update Database" node not found in workflow');
      process.exit(1);
    }

    console.log(`\n   Found "Update Database" node:`);
    console.log(`   Type: ${updateDbNode.type}`);
    console.log(`   Version: ${updateDbNode.typeVersion}`);

    // Step 4: Update node to use credential
    console.log('\n🔄 STEP 3: Updating Node Configuration');
    console.log('-'.repeat(60));

    // Remove manual headers and add credential reference
    const updatedNode = {
      ...updateDbNode,
      credentials: {
        httpHeaderAuth: {
          id: supabaseCred.id,
          name: supabaseCred.name
        }
      },
      // Keep URL and body, but remove manual authentication headers
      parameters: {
        ...updateDbNode.parameters,
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'httpHeaderAuth',
        // Remove manual header parameters for auth
        headerParameters: {
          parameters: updateDbNode.parameters.headerParameters.parameters.filter(h =>
            !['apikey', 'Authorization'].includes(h.name)
          )
        }
      }
    };

    // Update workflow with modified node
    const updatedWorkflow = {
      ...workflow,
      nodes: workflow.nodes.map(n =>
        n.name === 'Update Database' ? updatedNode : n
      )
    };

    // Step 5: Save updated workflow
    console.log('\n💾 STEP 4: Saving Updated Workflow');
    console.log('-'.repeat(60));

    await n8nApi(`/workflows/${WORKFLOW_ID}`, 'PATCH', updatedWorkflow);
    console.log('   ✅ Workflow updated successfully');

    // Step 6: Activate workflow
    console.log('\n✅ STEP 5: Activating Workflow');
    console.log('-'.repeat(60));

    await n8nApi(`/workflows/${WORKFLOW_ID}/activate`, 'POST');
    console.log('   ✅ Workflow activated');

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ CONFIGURATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n   Workflow: ${workflow.name}`);
    console.log(`   Credential: ${supabaseCred.name}`);
    console.log(`   Status: Active`);
    console.log(`\n   Next steps:`);
    console.log(`   1. Test campaign execution`);
    console.log(`   2. Verify database updates after sending messages`);
    console.log(`\n   Workflow URL:`);
    console.log(`   ${N8N_BASE_URL}/workflow/${WORKFLOW_ID}`);

  } catch (error) {
    console.error('\n❌ Configuration failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();
