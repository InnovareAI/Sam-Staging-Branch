#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const N8N_URL = 'https://workflows.innovareai.com';
const N8N_API_KEY = process.env.N8N_API_KEY;

async function reactivateWorkflow() {
    console.log('\n🔄 Reactivating N8N workflow to register webhook...\n');

    const headers = {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
    };

    const workflowId = 'aVG6LC4ZFRMN7Bw6';

    // Step 1: Deactivate
    console.log('Step 1: Deactivating workflow...');
    const deactivateResponse = await fetch(
        `${N8N_URL}/api/v1/workflows/${workflowId}/activate`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({ active: false })
        }
    );

    if (!deactivateResponse.ok) {
        console.log(`   Status: ${deactivateResponse.status}`);
        const error = await deactivateResponse.text();
        console.log(`   Error: ${error}\n`);
    } else {
        console.log('   ✅ Deactivated\n');
    }

    // Step 2: Wait a moment
    console.log('Step 2: Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✅ Done\n');

    // Step 3: Reactivate
    console.log('Step 3: Activating workflow...');
    const activateResponse = await fetch(
        `${N8N_URL}/api/v1/workflows/${workflowId}/activate`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({ active: true })
        }
    );

    if (!activateResponse.ok) {
        console.log(`   Status: ${activateResponse.status}`);
        const error = await activateResponse.text();
        console.log(`   Error: ${error}\n`);
    } else {
        console.log('   ✅ Activated\n');
    }

    // Step 4: Test webhook
    console.log('Step 4: Testing webhook registration...');
    const testResponse = await fetch(
        'https://workflows.innovareai.com/webhook/connector-campaign',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true })
        }
    );

    console.log(`   Status: ${testResponse.status}`);
    if (testResponse.status === 404) {
        console.log('   ❌ Webhook still not registered\n');
    } else {
        console.log('   ✅ Webhook is registered!\n');
    }

    console.log('🎉 Done! Workflow should be ready now.\n');
}

reactivateWorkflow();
