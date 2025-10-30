#!/usr/bin/env node
/**
 * Execute the Outreach Campaign to test N8N workflow
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
const CAMPAIGN_NAME = '20251030-IAI-Outreach Campaign';

async function executeCampaign() {
  console.log('🚀 EXECUTING OUTREACH CAMPAIGN\n');
  console.log('='.repeat(70));

  // Get campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('name', CAMPAIGN_NAME)
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log(`\n📋 Campaign: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);
  console.log(`   Status: ${campaign.status}`);

  // Check prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id);

  console.log(`   Prospects: ${prospects?.length || 0}`);

  if (!prospects || prospects.length === 0) {
    console.log('❌ No prospects to execute');
    return;
  }

  console.log('\n👥 Prospects to be contacted:');
  prospects.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} - ${p.title || 'N/A'}`);
  });

  console.log('\n🎯 Executing campaign (LIVE mode)...\n');

  // Execute campaign
  const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-trigger': 'manual-test'
    },
    body: JSON.stringify({
      campaignId: campaign.id,
      maxProspects: 3, // Execute all 3 prospects
      dryRun: false // LIVE execution
    })
  });

  const result = await response.json();

  console.log('='.repeat(70));
  console.log('📊 EXECUTION RESULTS');
  console.log('='.repeat(70));

  console.log(`\n   Status: ${response.status}`);
  console.log(`   Success: ${result.success ? '✅' : '❌'}`);
  console.log(`   Mode: ${result.execution_mode}`);
  console.log(`   N8N Triggered: ${result.n8n_triggered ? '✅ YES' : '❌ NO'}`);

  if (result.queued_prospects && result.queued_prospects.length > 0) {
    console.log(`\n   ✅ Queued ${result.queued_prospects.length} prospects in N8N:\n`);
    result.queued_prospects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.prospect}`);
      console.log(`      LinkedIn: ${p.linkedin_url}`);
      console.log(`      Status: ${p.status}`);
    });
  }

  if (result.errors && result.errors.length > 0) {
    console.log('\n   ⚠️ Errors:');
    result.errors.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.error || e.message || JSON.stringify(e)}`);
    });
  }

  if (result.n8n_webhook_url) {
    console.log(`\n   🔗 N8N Webhook: ${result.n8n_webhook_url}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('🎯 NEXT STEPS');
  console.log('='.repeat(70));
  console.log('\n1. Check N8N workflow executions:');
  console.log('   https://workflows.innovareai.com/executions');
  console.log('\n2. Monitor prospect status in database');
  console.log('\n3. Check for any error logs');
  console.log('\n' + '='.repeat(70));
}

executeCampaign().catch(console.error);
