#!/usr/bin/env node

/**
 * Execute all 3 Charissa campaigns - sends 1 prospect at a time to N8N
 * BASED ON WORKING KALAN TEST SCRIPT
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // IA4
const UNIPILE_ACCOUNT_ID = '4nt1J-blSnGUPBjH2Nfjpg'; // Charissa

const CAMPAIGNS = [
  {
    name: '20251117-IA4-Outreach Campaign',
    id: '683f9214-8a3f-4015-98fe-aa3ae76a9ebe'
  },
  {
    name: 'Cha Canada Campaign',
    id: '35415fff-a230-48c6-ae91-e8f170cd3232'
  },
  {
    name: 'SAM Startup Canada',
    id: '3326aa89-9220-4bef-a1db-9c54f14fc536'
  }
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendProspectToN8N(campaign, prospect, message) {
  const linkedinUsername = prospect.linkedin_url
    ? prospect.linkedin_url.split('/in/')[1]?.replace(/\/$/, '')
    : null;

  const payload = {
    workspaceId: WORKSPACE_ID,
    campaignId: campaign.id,
    channel: 'linkedin',
    campaignType: 'connector',
    unipileAccountId: UNIPILE_ACCOUNT_ID,
    unipile_account_id: UNIPILE_ACCOUNT_ID,

    prospects: [{
      id: prospect.id,
      firstName: prospect.first_name,
      first_name: prospect.first_name,
      lastName: prospect.last_name,
      last_name: prospect.last_name,
      linkedinUrl: prospect.linkedin_url,
      linkedin_url: prospect.linkedin_url,
      linkedinUsername: linkedinUsername,
      linkedin_username: linkedinUsername,
      companyName: prospect.company_name,
      company_name: prospect.company_name,
      title: prospect.title,
      sendDelayMinutes: 0,
      send_delay_minutes: 0
    }],

    messages: {
      connectionRequest: message,
      connection_request: message,
      cr: message
    },

    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    unipile_dsn: process.env.UNIPILE_DSN,
    unipile_api_key: process.env.UNIPILE_API_KEY
  };

  const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}

async function executeCampaign(campaign) {
  console.log(`\n🚀 Campaign: ${campaign.name}`);
  console.log(`   ID: ${campaign.id}`);

  // Get campaign templates
  const { data: campaignData, error: campaignError } = await supabase
    .from('campaigns')
    .select('message_templates')
    .eq('id', campaign.id)
    .single();

  if (campaignError) {
    console.error(`❌ Failed to fetch campaign:`, campaignError);
    return;
  }

  const message = campaignData.message_templates?.connection_request;
  if (!message) {
    console.error(`❌ No connection_request message found`);
    return;
  }

  console.log(`📝 Message: ${message.substring(0, 50)}...`);

  // Get pending prospects
  const { data: prospects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, company_name, title')
    .eq('campaign_id', campaign.id)
    .eq('status', 'pending')
    .order('created_at');

  if (prospectsError) {
    console.error(`❌ Failed to fetch prospects:`, prospectsError);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log(`⚠️  No pending prospects`);
    return;
  }

  console.log(`📊 Found ${prospects.length} pending prospects\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    console.log(`\n📤 [${i + 1}/${prospects.length}] Sending: ${prospect.first_name} ${prospect.last_name}`);

    try {
      await sendProspectToN8N(campaign, prospect, message);
      console.log(`   ✅ Sent successfully`);

      // Update status
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({ status: 'queued_in_n8n' })
        .eq('id', prospect.id);

      if (updateError) {
        console.error(`   ⚠️  Failed to update status:`, updateError);
      }

      successCount++;
    } catch (error) {
      console.error(`   ❌ Failed:`, error.message);
      failCount++;
    }

    // Wait 10 seconds between prospects to avoid N8N timeout
    if (i < prospects.length - 1) {
      console.log(`   ⏳ Waiting 10 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Campaign ${campaign.name} complete`);
  console.log(`   Success: ${successCount}/${prospects.length}`);
  console.log(`   Failed: ${failCount}/${prospects.length}`);
  console.log(`${'='.repeat(60)}\n`);

  // Update campaign status
  await supabase
    .from('campaigns')
    .update({ status: 'active', last_executed_at: new Date().toISOString() })
    .eq('id', campaign.id);
}

console.log('🎯 Executing Charissa\'s 3 campaigns\n');

for (const campaign of CAMPAIGNS) {
  await executeCampaign(campaign);
}

console.log('\n🎉 All campaigns executed!');
console.log('Monitor at: https://workflows.innovareai.com\n');
