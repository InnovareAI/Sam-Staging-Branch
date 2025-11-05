#!/usr/bin/env node

/**
 * Setup N8N Enrichment Workflow
 *
 * This script helps set up the N8N enrichment workflow by:
 * 1. Checking the database structure
 * 2. Providing instructions to import the workflow
 * 3. Testing the webhook connection
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔧 N8N Enrichment Workflow Setup');
console.log('================================\n');

// Step 1: Check database structure
console.log('📊 Step 1: Checking Database Structure...\n');

async function checkDatabase() {
  // Check enrichment_jobs table
  const { data: jobs, error: jobsError } = await supabase
    .from('enrichment_jobs')
    .select('*')
    .limit(1);

  if (jobsError) {
    console.error('❌ enrichment_jobs table error:', jobsError.message);
    return false;
  }

  console.log('✅ enrichment_jobs table exists');

  // Check prospect_approval_data table
  const { data: prospects, error: prospectsError } = await supabase
    .from('prospect_approval_data')
    .select('id, prospect_id, name, contact')
    .limit(1);

  if (prospectsError) {
    console.error('❌ prospect_approval_data table error:', prospectsError.message);
    return false;
  }

  console.log('✅ prospect_approval_data table exists');

  // Check if contact field has linkedin_url
  if (prospects && prospects[0]) {
    const contact = prospects[0].contact;
    console.log('\n📋 Contact JSONB structure:');
    console.log('   Keys:', Object.keys(contact || {}).join(', '));

    if (contact?.linkedin_url) {
      console.log('   ✅ linkedin_url field exists');
    } else {
      console.log('   ⚠️  linkedin_url field missing (this is expected if no prospects have been scraped yet)');
    }

    if (contact?.email !== undefined || contact?.phone !== undefined) {
      console.log('   ✅ email/phone fields exist');
    }
  }

  return true;
}

// Step 2: Display workflow import instructions
function displayWorkflowInstructions() {
  console.log('\n\n📥 Step 2: Import N8N Workflow');
  console.log('================================\n');

  console.log('The N8N workflow file is located at:');
  console.log('   📄 /n8n-workflows/prospect-enrichment-workflow.json\n');

  console.log('To import into N8N:\n');
  console.log('1. Open N8N: https://workflows.innovareai.com');
  console.log('2. Click "Import from File" (or Workflows → Import)');
  console.log('3. Select: n8n-workflows/prospect-enrichment-workflow.json');
  console.log('4. Configure Supabase credentials in N8N:');
  console.log('   - URL:', supabaseUrl);
  console.log('   - Service Role Key: (from SUPABASE_SERVICE_ROLE_KEY env var)');
  console.log('5. Activate the workflow (toggle in top-right)');
  console.log('6. Verify webhook path: /webhook/prospect-enrichment\n');

  console.log('⚠️  IMPORTANT: The workflow expects these environment variables:');
  console.log('   - BRIGHTDATA_API_TOKEN (BrightData API key)');
  console.log('   - BRIGHTDATA_ZONE (default: linkedin_enrichment)');
}

// Step 3: Check N8N webhook connectivity
async function testWebhook() {
  console.log('\n\n🧪 Step 3: Test N8N Webhook');
  console.log('================================\n');

  const webhookUrl = process.env.N8N_ENRICHMENT_WEBHOOK_URL ||
    'https://workflows.innovareai.com/webhook/prospect-enrichment';

  console.log('Testing webhook:', webhookUrl);

  try {
    const response = await fetch(webhookUrl, {
      method: 'GET'
    });

    if (response.status === 404) {
      console.log('⚠️  Webhook not found (expected if workflow not imported yet)');
      console.log('   Status:', response.status, response.statusText);
      return false;
    } else {
      console.log('✅ Webhook is accessible');
      console.log('   Status:', response.status, response.statusText);
      return true;
    }
  } catch (error) {
    console.log('❌ Webhook connection failed:', error.message);
    return false;
  }
}

// Step 4: Display next steps
function displayNextSteps(webhookExists) {
  console.log('\n\n✅ Next Steps');
  console.log('================================\n');

  if (!webhookExists) {
    console.log('1. Import the N8N workflow (see instructions above)');
    console.log('2. Activate the workflow in N8N');
    console.log('3. Run this script again to verify webhook');
    console.log('4. Test enrichment with 1 prospect in the UI');
  } else {
    console.log('1. ✅ Workflow is ready!');
    console.log('2. Test enrichment with 1 prospect:');
    console.log('   - Go to Data Collection Hub');
    console.log('   - Select a prospect with LinkedIn URL');
    console.log('   - Click "Enrich Selected"');
    console.log('3. Monitor N8N execution:');
    console.log('   - https://workflows.innovareai.com/executions');
    console.log('4. Check database for results:');
    console.log('   - enrichment_jobs table for job status');
    console.log('   - prospect_approval_data.contact for enriched data');
  }

  console.log('\n📚 Documentation:');
  console.log('   - N8N_ENRICHMENT_SETUP.md (full setup guide)');
  console.log('   - n8n-workflows/prospect-enrichment-workflow.json (workflow definition)');
}

// Run all steps
async function main() {
  const dbOk = await checkDatabase();

  if (!dbOk) {
    console.log('\n❌ Database setup incomplete. Please run database migrations first.');
    process.exit(1);
  }

  displayWorkflowInstructions();
  const webhookExists = await testWebhook();
  displayNextSteps(webhookExists);

  console.log('\n✨ Setup script complete!\n');
}

main().catch(console.error);
