#!/usr/bin/env node
/**
 * Comprehensive Dry Run Test
 * Shows full campaign execution flow without sending messages
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

const CAMPAIGN_ID = '73bedc34-3b24-4315-8cf1-043e454019af';

async function dryRunTest() {
  console.log('🧪 DRY RUN TEST - Full Campaign Execution Flow\n');
  console.log('='.repeat(60));
  
  // Step 1: Check campaign details
  console.log('\n📋 STEP 1: Campaign Details');
  console.log('-'.repeat(60));
  
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, workspaces(name)')
    .eq('id', CAMPAIGN_ID)
    .single();
  
  console.log(`   Name: ${campaign.name}`);
  console.log(`   Workspace: ${campaign.workspaces.name}`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Created: ${new Date(campaign.created_at).toLocaleDateString()}`);
  
  // Step 2: Check prospects
  console.log('\n👥 STEP 2: Campaign Prospects');
  console.log('-'.repeat(60));
  
  const { data: allProspects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID);
  
  const ready = allProspects.filter(p => 
    !p.contacted_at && 
    p.linkedin_url && 
    ['pending', 'approved', 'ready_to_message'].includes(p.status)
  );
  
  const contacted = allProspects.filter(p => p.contacted_at);
  const queued = allProspects.filter(p => p.status === 'queued_in_n8n');
  
  console.log(`   Total prospects: ${allProspects.length}`);
  console.log(`   Ready to message: ${ready.length}`);
  console.log(`   Already contacted: ${contacted.length}`);
  console.log(`   Queued in N8N: ${queued.length}`);
  
  if (ready.length > 0) {
    console.log('\n   Ready prospects:');
    ready.slice(0, 3).forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
      console.log(`      Title: ${p.title || 'N/A'}`);
      console.log(`      Company: ${p.company_name || 'N/A'}`);
      console.log(`      LinkedIn: ${p.linkedin_url}`);
    });
  }
  
  // Step 3: Check LinkedIn account
  console.log('\n🔗 STEP 3: LinkedIn Account');
  console.log('-'.repeat(60));
  
  const { data: linkedinAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('user_id', campaign.created_by)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();
  
  if (linkedinAccount) {
    console.log(`   ✅ Account: ${linkedinAccount.account_name}`);
    console.log(`   Status: ${linkedinAccount.connection_status}`);
    console.log(`   Unipile ID: ${linkedinAccount.unipile_account_id}`);
    console.log(`   Daily limit: ${linkedinAccount.daily_message_limit}`);
    console.log(`   Sent today: ${linkedinAccount.messages_sent_today}`);
  } else {
    console.log('   ❌ No LinkedIn account found');
  }
  
  // Step 4: Check message templates
  console.log('\n✉️  STEP 4: Message Templates');
  console.log('-'.repeat(60));
  
  const connectionMsg = campaign.connection_message || campaign.message_templates?.connection_request;
  const followUpMsgs = campaign.follow_up_messages || campaign.message_templates?.follow_up_messages || [];
  
  console.log(`   Connection message: ${connectionMsg ? '✅ Configured' : '❌ Missing'}`);
  if (connectionMsg) {
    console.log(`   Preview: "${connectionMsg.substring(0, 80)}..."`);
  }
  console.log(`   Follow-up messages: ${followUpMsgs.length} configured`);
  
  // Step 5: Execute dry run
  console.log('\n🚀 STEP 5: Dry Run Execution');
  console.log('-'.repeat(60));
  
  const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-trigger': 'cron-pending-prospects'
    },
    body: JSON.stringify({
      campaignId: CAMPAIGN_ID,
      maxProspects: 3,
      dryRun: true
    })
  });
  
  const result = await response.json();
  
  console.log(`   API Status: ${response.status}`);
  console.log(`   Success: ${result.success ? '✅' : '❌'}`);
  console.log(`   Mode: ${result.execution_mode}`);
  console.log(`   N8N Triggered: ${result.n8n_triggered ? 'Yes' : 'No (dry run)'}`);
  
  if (result.queued_prospects && result.queued_prospects.length > 0) {
    console.log(`\n   Would queue ${result.queued_prospects.length} prospects:`);
    result.queued_prospects.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.prospect}`);
      console.log(`      LinkedIn: ${p.linkedin_url}`);
    });
  }
  
  if (result.errors && result.errors.length > 0) {
    console.log('\n   ⚠️  Errors:');
    result.errors.forEach(e => {
      console.log(`   - ${e.error || e}`);
    });
  }
  
  // Step 6: N8N Workflow Status
  console.log('\n⚙️  STEP 6: N8N Workflow Configuration');
  console.log('-'.repeat(60));
  
  const webhookUrl = process.env.N8N_CAMPAIGN_WEBHOOK_URL;
  console.log(`   Webhook URL: ${webhookUrl || '❌ Not configured'}`);
  console.log(`   Workflow: SAM Master Campaign Orchestrator`);
  console.log(`   ID: aVG6LC4ZFRMN7Bw6`);
  console.log(`   Link: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6`);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DRY RUN SUMMARY');
  console.log('='.repeat(60));
  
  const canExecute = ready.length > 0 && linkedinAccount && connectionMsg;
  
  console.log(`\n   Campaign Status: ${campaign.status.toUpperCase()}`);
  console.log(`   Ready Prospects: ${ready.length}`);
  console.log(`   LinkedIn Account: ${linkedinAccount ? '✅ Connected' : '❌ Not connected'}`);
  console.log(`   Message Templates: ${connectionMsg ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   N8N Webhook: ${webhookUrl ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`\n   🎯 Execution Ready: ${canExecute ? '✅ YES' : '❌ NO'}`);
  
  if (canExecute) {
    console.log('\n   ✅ To execute LIVE:');
    console.log('   node scripts/js/test-campaign-live-execution.mjs');
  } else {
    console.log('\n   ⚠️  Cannot execute - fix issues above first');
  }
  
  console.log('\n' + '='.repeat(60));
}

dryRunTest().catch(console.error);
