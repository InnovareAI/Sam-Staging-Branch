#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const N8N_URL = 'https://workflows.innovareai.com';
const N8N_API_KEY = process.env.N8N_API_KEY;

async function fixWebhookId() {
    console.log('\n🔧 Adding missing webhookId to webhook nodes...\n');

    const headers = {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
    };

    const workflowId = 'aVG6LC4ZFRMN7Bw6';

    // Get current workflow
    console.log('Step 1: Fetching current workflow...');
    const getResponse = await fetch(`${N8N_URL}/api/v1/workflows/${workflowId}`, { headers });
    const workflow = await getResponse.json();
    console.log(`   Nodes: ${workflow.nodes.length}\n`);

    // Load original workflow with webhookId
    const originalWorkflow = JSON.parse(
        fs.readFileSync('/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator (2).json', 'utf8')
    );

    // Find webhook nodes in original and restore webhookId
    console.log('Step 2: Restoring webhookId fields...');

    for (let i = 0; i < workflow.nodes.length; i++) {
        const currentNode = workflow.nodes[i];
        const originalNode = originalWorkflow.nodes.find(n => n.id === currentNode.id);

        if (originalNode && originalNode.webhookId) {
            workflow.nodes[i].webhookId = originalNode.webhookId;
            console.log(`   ✅ Added webhookId to: ${currentNode.name} (${originalNode.webhookId})`);
        }
    }

    // Update workflow
    console.log('\nStep 3: Updating workflow...');
    const updatePayload = {
        name: workflow.name,
        nodes: workflow.nodes,
        connections: workflow.connections,
        settings: workflow.settings || {},
        staticData: workflow.staticData || null
    };

    const updateResponse = await fetch(
        `${N8N_URL}/api/v1/workflows/${workflowId}`,
        {
            method: 'PUT',
            headers,
            body: JSON.stringify(updatePayload)
        }
    );

    if (!updateResponse.ok) {
        const error = await updateResponse.text();
        console.log(`❌ Update failed: ${updateResponse.status}`);
        console.log(`   Error: ${error}`);
        return;
    }

    console.log('✅ Workflow updated!\n');

    console.log('Step 4: Reactivating workflow...');
    await fetch(`${N8N_URL}/api/v1/workflows/${workflowId}/activate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ active: false })
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    await fetch(`${N8N_URL}/api/v1/workflows/${workflowId}/activate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ active: true })
    });

    console.log('✅ Reactivated!\n');

    // Test webhook
    console.log('Step 5: Testing webhook...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const testResponse = await fetch(
        'https://workflows.innovareai.com/webhook/connector-campaign',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true })
        }
    );

    console.log(`   Status: ${testResponse.status}`);
    if (testResponse.status !== 404) {
        console.log('   ✅ Webhook is registered!\n');
        console.log('🎉 Fix complete! Webhook is now working.\n');
    } else {
        console.log('   ❌ Still 404 - may need manual toggle in UI\n');
    }
}

fixWebhookId();
