#!/usr/bin/env node
/**
 * Debug Execution Failure
 * Investigates why campaign 73bedc34 failed to queue prospects
 */

import { createClient } from '@supabase/supabase-js';
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

async function debug() {
  console.log('🔍 DEBUGGING EXECUTION FAILURE\n');
  console.log('='.repeat(80));

  // Check all prospects current status
  console.log('\n👥 ALL PROSPECTS - CURRENT STATUS');
  console.log('-'.repeat(80));

  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', CAMPAIGN_ID)
    .order('created_at', { ascending: false });

  console.log(`\nTotal prospects: ${prospects?.length || 0}\n`);

  prospects?.forEach((p, i) => {
    console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
    console.log(`   Status: ${p.status}`);
    console.log(`   LinkedIn URL: ${p.linkedin_url || 'MISSING'}`);
    console.log(`   LinkedIn Internal ID: ${p.linkedin_internal_id || 'MISSING'}`);
    console.log(`   Contacted At: ${p.contacted_at || 'Not contacted'}`);
    console.log(`   Created By: ${p.created_by || 'N/A'}`);
    console.log(`   Personalization Data: ${JSON.stringify(p.personalization_data || {}, null, 2)}`);
    console.log('');
  });

  // Check LinkedIn account
  console.log('🔗 LINKEDIN ACCOUNT');
  console.log('-'.repeat(80));

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, workspaces(name)')
    .eq('id', CAMPAIGN_ID)
    .single();

  const { data: linkedinAccount } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('user_id', campaign.created_by)
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();

  if (linkedinAccount) {
    console.log(`\n   ✅ Account: ${linkedinAccount.account_name}`);
    console.log(`   Unipile ID: ${linkedinAccount.unipile_account_id}`);
    console.log(`   Status: ${linkedinAccount.connection_status}`);
    console.log(`   Daily limit: ${linkedinAccount.daily_message_limit}`);
    console.log(`   Sent today: ${linkedinAccount.messages_sent_today}`);
    console.log(`   User ID: ${linkedinAccount.user_id}`);
  } else {
    console.log('\n   ❌ No LinkedIn account found');
  }

  // Analyze why prospects might have failed
  console.log('\n🔎 FAILURE ANALYSIS');
  console.log('-'.repeat(80));

  const readyProspects = prospects?.filter(p =>
    !p.contacted_at &&
    p.linkedin_url &&
    ['pending', 'approved', 'ready_to_message'].includes(p.status)
  ) || [];

  const missingUrl = prospects?.filter(p => !p.linkedin_url) || [];
  const missingInternalId = prospects?.filter(p => !p.linkedin_internal_id) || [];
  const alreadyContacted = prospects?.filter(p => p.contacted_at) || [];
  const queued = prospects?.filter(p => p.status === 'queued_in_n8n') || [];

  console.log(`\n   Ready for execution: ${readyProspects.length}`);
  console.log(`   Missing LinkedIn URL: ${missingUrl.length}`);
  console.log(`   Missing LinkedIn Internal ID: ${missingInternalId.length}`);
  console.log(`   Already contacted: ${alreadyContacted.length}`);
  console.log(`   Already queued: ${queued.length}`);

  if (readyProspects.length > 0) {
    console.log('\n   ✅ READY PROSPECTS:');
    readyProspects.forEach(p => {
      console.log(`      - ${p.first_name} ${p.last_name} (${p.status})`);

      // Check ownership
      const ownershipMatch = linkedinAccount && p.created_by === linkedinAccount.user_id;
      console.log(`        Ownership: ${ownershipMatch ? '✅' : '❌'} (prospect created_by: ${p.created_by}, account user_id: ${linkedinAccount?.user_id})`);
    });
  }

  if (missingInternalId.length > 0) {
    console.log('\n   ⚠️  MISSING INTERNAL ID (will fail ownership check):');
    missingInternalId.forEach(p => {
      console.log(`      - ${p.first_name} ${p.last_name}`);
    });
  }

  // Check campaign configuration
  console.log('\n⚙️  CAMPAIGN CONFIGURATION');
  console.log('-'.repeat(80));

  const connectionMsg = campaign.connection_message || campaign.message_templates?.connection_request;
  const followUpMsgs = campaign.follow_up_messages || campaign.message_templates?.follow_up_messages || [];

  console.log(`\n   Connection message: ${connectionMsg ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Follow-up messages: ${followUpMsgs.length} configured`);
  console.log(`   Status: ${campaign.status}`);
  console.log(`   Created by: ${campaign.created_by}`);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 DIAGNOSIS');
  console.log('='.repeat(80));

  console.log('\n   LIKELY ISSUE:');

  if (readyProspects.length === 0) {
    console.log('   ❌ No prospects are in ready state');
  } else if (!linkedinAccount) {
    console.log('   ❌ LinkedIn account not connected');
  } else {
    // Check if ownership is the issue
    const ownershipIssues = readyProspects.filter(p => p.created_by !== linkedinAccount.user_id);
    if (ownershipIssues.length > 0) {
      console.log('   ⚠️  OWNERSHIP MISMATCH:');
      console.log(`      ${ownershipIssues.length} prospect(s) were not added via the LinkedIn account`);
      console.log(`      These will fail the ownership validation check`);
      ownershipIssues.forEach(p => {
        console.log(`      - ${p.first_name} ${p.last_name} (created_by: ${p.created_by})`);
      });
    }

    const internalIdIssues = readyProspects.filter(p => !p.linkedin_internal_id);
    if (internalIdIssues.length > 0) {
      console.log('\n   ⚠️  MISSING LINKEDIN INTERNAL ID:');
      console.log(`      ${internalIdIssues.length} prospect(s) missing linkedin_internal_id`);
      console.log(`      Cannot verify ownership without internal ID`);
      internalIdIssues.forEach(p => {
        console.log(`      - ${p.first_name} ${p.last_name}`);
      });
    }
  }

  console.log('\n' + '='.repeat(80));
}

debug().catch(console.error);
