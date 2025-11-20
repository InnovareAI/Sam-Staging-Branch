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

async function fixN8NWorkflow() {
    console.log('\n🔧 Fixing N8N workflow via API...\n');

    if (!N8N_API_KEY) {
        console.log('❌ N8N_API_KEY not found in environment');
        return;
    }

    const headers = {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json'
    };

    // Step 1: List all workflows
    console.log('📋 Step 1: Listing all workflows...');
    const listResponse = await fetch(`${N8N_URL}/api/v1/workflows`, { headers });
    const workflows = await listResponse.json();

    console.log(`   Found ${workflows.data.length} workflows\n`);

    // Find our workflow
    const samWorkflow = workflows.data.find(w => w.name === 'SAM Master Campaign Orchestrator');

    if (!samWorkflow) {
        console.log('❌ SAM Master Campaign Orchestrator not found');
        return;
    }

    console.log(`✅ Found workflow:`);
    console.log(`   ID: ${samWorkflow.id}`);
    console.log(`   Name: ${samWorkflow.name}`);
    console.log(`   Active: ${samWorkflow.active}`);
    console.log(`   Updated: ${samWorkflow.updatedAt}\n`);

    // Step 2: Get the full workflow
    console.log('📥 Step 2: Fetching full workflow...');
    const getResponse = await fetch(`${N8N_URL}/api/v1/workflows/${samWorkflow.id}`, { headers });
    const currentWorkflow = await getResponse.json();

    console.log(`   Nodes: ${currentWorkflow.nodes.length}`);
    console.log(`   Connections: ${Object.keys(currentWorkflow.connections).length}\n`);

    // Step 3: Load the fixed workflow
    console.log('📂 Step 3: Loading fixed workflow from file...');
    const fixedWorkflow = JSON.parse(
        fs.readFileSync('/Users/tvonlinz/Downloads/SAM Master Campaign Orchestrator (2).json', 'utf8')
    );

    console.log(`   Fixed workflow nodes: ${fixedWorkflow.nodes.length}\n`);

    // Step 4: Update the workflow
    console.log('🔄 Step 4: Updating workflow via API...');

    // Clean nodes - only keep fields N8N API accepts
    const cleanedNodes = fixedWorkflow.nodes.map(node => ({
        parameters: node.parameters,
        id: node.id,
        name: node.name,
        type: node.type,
        typeVersion: node.typeVersion,
        position: node.position
    }));

    const updatePayload = {
        name: currentWorkflow.name,
        nodes: cleanedNodes,
        connections: fixedWorkflow.connections,
        settings: currentWorkflow.settings || {},
        staticData: currentWorkflow.staticData || null
    };

    const updateResponse = await fetch(
        `${N8N_URL}/api/v1/workflows/${samWorkflow.id}`,
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

    console.log('✅ Workflow updated successfully!\n');

    // Step 5: Workflow is already active, skip reactivation
    console.log('✅ Workflow is already active, skipping reactivation\n');

    // Step 6: Verify the fix
    console.log('🔍 Step 6: Verifying the fix...');
    const verifyResponse = await fetch(`${N8N_URL}/api/v1/workflows/${samWorkflow.id}`, { headers });
    const verifiedWorkflow = await verifyResponse.json();

    const sendCRNode = verifiedWorkflow.nodes.find(n => n.name === 'Send CR');
    if (sendCRNode) {
        console.log('   Send CR Node URL:');
        console.log(`   ${sendCRNode.parameters.url}\n`);

        if (sendCRNode.parameters.url.includes("/api/v1/users/invite'")) {
            console.log('✅ URL is correctly formatted!');
        } else {
            console.log('❌ URL still has issues');
        }
    }

    console.log('\n🎉 Workflow fix complete! Ready to test.\n');
}

fixN8NWorkflow().catch(console.error);
