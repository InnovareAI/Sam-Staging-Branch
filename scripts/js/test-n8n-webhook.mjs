#!/usr/bin/env node
/**
 * Test N8N Webhook Connection
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

console.log('🔍 Testing N8N Webhook Connection\n');

const N8N_WEBHOOK_URL = process.env.N8N_CAMPAIGN_WEBHOOK_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

console.log('Configuration:');
console.log(`  Webhook URL: ${N8N_WEBHOOK_URL}`);
console.log(`  API Key: ${N8N_API_KEY ? `${N8N_API_KEY.substring(0, 20)}...` : 'NOT SET'}`);
console.log('');

if (!N8N_WEBHOOK_URL) {
  console.error('❌ N8N_CAMPAIGN_WEBHOOK_URL not set in .env.local');
  process.exit(1);
}

async function testWebhook() {
  console.log('📡 Sending test payload to N8N webhook...\n');

  const testPayload = {
    test: true,
    campaign_id: 'test-campaign-id',
    workspace_id: 'test-workspace-id',
    message: 'Test connection from Node.js'
  };

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(N8N_API_KEY ? { 'Authorization': `Bearer ${N8N_API_KEY}` } : {})
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Webhook Error:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Response: ${errorText.substring(0, 500)}`);
      console.error('');
      return { success: false, error: errorText };
    }

    const responseData = await response.json();
    console.log('✅ Webhook Response:');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('');

    return { success: true, data: responseData };

  } catch (error) {
    console.error('❌ Connection Error:');
    console.error(`   ${error.message}`);
    console.error('');
    return { success: false, error: error.message };
  }
}

async function checkN8NWorkflows() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Checking N8N Workflows');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const N8N_API_URL = process.env.N8N_API_BASE_URL || process.env.N8N_INSTANCE_URL;

  if (!N8N_API_URL) {
    console.log('⚠️  N8N API URL not configured\n');
    return;
  }

  try {
    console.log(`📡 Calling: ${N8N_API_URL}/api/v1/workflows\n`);

    const response = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY || '',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}\n`);
      return;
    }

    const data = await response.json();
    console.log(`✅ Found ${data.data?.length || 0} workflows\n`);

    if (data.data && data.data.length > 0) {
      console.log('📋 Active Workflows:');
      console.log('─────────────────────────────────────');
      for (const workflow of data.data) {
        console.log(`  ${workflow.active ? '✅' : '⏸️'} ${workflow.name}`);
        console.log(`     ID: ${workflow.id}`);
        console.log(`     Active: ${workflow.active}`);
        console.log('─────────────────────────────────────');
      }
      console.log('');
    }

  } catch (error) {
    console.error(`❌ Error checking workflows: ${error.message}\n`);
  }
}

async function run() {
  const webhookResult = await testWebhook();
  await checkN8NWorkflows();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (webhookResult.success) {
    console.log('✅ N8N webhook is responding');
    console.log('✅ Connection successful');
    console.log('\n🎯 RECOMMENDATION: N8N is working, check workflow configuration');
  } else {
    console.log('❌ N8N webhook is NOT responding');
    console.log(`   Error: ${webhookResult.error}`);
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('   1. Check if N8N instance is running');
    console.log('   2. Verify webhook URL is correct');
    console.log('   3. Check if workflow with webhook is active');
    console.log('   4. Verify API key has correct permissions');
  }

  console.log('');
}

run().catch(console.error);
