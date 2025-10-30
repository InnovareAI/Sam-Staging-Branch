#!/usr/bin/env node
/**
 * Test Messaging System - End-to-End Campaign Test
 * Tests: Campaigns → Prospects → LinkedIn Messaging
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMessagingSystem() {
  console.log('🧪 Testing Messaging System\n');

  // Step 1: Check for active campaigns
  console.log('1️⃣ Checking for active campaigns...');
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, workspace_id, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5);

  if (campaignsError) {
    console.error('❌ Error fetching campaigns:', campaignsError.message);
    return;
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('⚠️  No active campaigns found');
    console.log('\n💡 To create a campaign:');
    console.log('   1. Go to your app (http://localhost:3000)');
    console.log('   2. Create a workspace');
    console.log('   3. Add prospects');
    console.log('   4. Create a campaign');
    return;
  }

  console.log(`✅ Found ${campaigns.length} active campaigns:`);
  campaigns.forEach(c => {
    console.log(`   - ${c.name} (ID: ${c.id.slice(0, 8)}...)`);
  });

  // Step 2: Check prospects for first campaign
  const testCampaign = campaigns[0];
  console.log(`\n2️⃣ Checking prospects for campaign: ${testCampaign.name}...`);

  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status, linkedin_url, contacted_at')
    .eq('campaign_id', testCampaign.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (prospectsError) {
    console.error('❌ Error fetching prospects:', prospectsError.message);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log('⚠️  No prospects found for this campaign');
    console.log('\n💡 To add prospects:');
    console.log('   POST /api/campaigns/add-approved-prospects');
    return;
  }

  console.log(`✅ Found ${prospects.length} prospects:`);

  const readyProspects = prospects.filter(p =>
    !p.contacted_at &&
    p.linkedin_url &&
    ['pending', 'approved', 'ready_to_message'].includes(p.status)
  );

  const contactedProspects = prospects.filter(p => p.contacted_at);

  console.log(`   - Ready to message: ${readyProspects.length}`);
  console.log(`   - Already contacted: ${contactedProspects.length}`);

  if (readyProspects.length > 0) {
    console.log('\n   Ready prospects:');
    readyProspects.slice(0, 3).forEach(p => {
      console.log(`     • ${p.first_name} ${p.last_name} - ${p.status}`);
    });
  }

  if (contactedProspects.length > 0) {
    console.log('\n   Already contacted:');
    contactedProspects.slice(0, 3).forEach(p => {
      console.log(`     • ${p.first_name} ${p.last_name} - ${new Date(p.contacted_at).toLocaleDateString()}`);
    });
  }

  // Step 3: Check LinkedIn account connection
  console.log('\n3️⃣ Checking LinkedIn account connection...');

  const { data: linkedinAccounts, error: accountsError } = await supabase
    .from('workspace_accounts')
    .select('id, provider, status, account_name, unipile_account_id')
    .eq('workspace_id', testCampaign.workspace_id)
    .eq('provider', 'linkedin');

  if (accountsError) {
    console.error('❌ Error fetching LinkedIn accounts:', accountsError.message);
    return;
  }

  if (!linkedinAccounts || linkedinAccounts.length === 0) {
    console.log('⚠️  No LinkedIn account connected');
    console.log('\n💡 To connect LinkedIn:');
    console.log('   1. Go to Workspace Settings → Integrations');
    console.log('   2. Connect LinkedIn via OAuth');
    return;
  }

  const activeAccount = linkedinAccounts.find(a => a.status === 'active');

  if (!activeAccount) {
    console.log('⚠️  LinkedIn account connected but not active');
    console.log('   Accounts:', linkedinAccounts.map(a => `${a.account_name} (${a.status})`).join(', '));
    return;
  }

  console.log(`✅ LinkedIn account active: ${activeAccount.account_name}`);
  console.log(`   Unipile ID: ${activeAccount.unipile_account_id || 'Not set'}`);

  // Step 4: Test execution readiness
  console.log('\n4️⃣ Campaign execution readiness:');

  if (readyProspects.length === 0) {
    console.log('⚠️  No prospects ready to message');
    console.log('   All prospects have been contacted or need approval');
  } else {
    console.log('✅ Ready to execute campaign!');
    console.log(`   ${readyProspects.length} prospects ready for outreach`);
    console.log('\n💡 To execute campaign (DRY RUN):');
    console.log(`   curl -X POST http://localhost:3000/api/campaigns/linkedin/execute-live \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"campaignId": "${testCampaign.id}", "maxProspects": 1, "dryRun": true}'`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Active Campaigns: ${campaigns.length}`);
  console.log(`Test Campaign: ${testCampaign.name}`);
  console.log(`Prospects: ${prospects.length} total, ${readyProspects.length} ready`);
  console.log(`LinkedIn: ${activeAccount ? '✅ Connected' : '❌ Not connected'}`);
  console.log(`Status: ${readyProspects.length > 0 && activeAccount ? '✅ READY' : '⚠️  NEEDS SETUP'}`);
  console.log('='.repeat(60));
}

testMessagingSystem().catch(console.error);
