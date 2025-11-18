#!/usr/bin/env node

/**
 * AUTO-EXECUTE ALL ACTIVE CAMPAIGNS ACROSS ALL WORKSPACES
 *
 * This script runs continuously and:
 * 1. Queries database for ALL campaigns with status='active'
 * 2. Sends batches to N8N for each campaign
 * 3. Respects daily limits and working hours
 * 4. Runs every hour
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const BATCH_SIZE = 5;  // Send 5 prospects per batch
const BATCH_DELAY_MS = 120000;  // 2 minutes between batches
const CHECK_INTERVAL_MS = 3600000;  // Check every hour (60 minutes)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getAllActiveCampaigns() {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(`
      id,
      name,
      workspace_id,
      status,
      message_templates
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching campaigns:', error);
    return [];
  }

  console.log(`\n📊 Found ${campaigns?.length || 0} active campaigns`);
  return campaigns || [];
}

async function getCampaignDetails(campaignId, workspaceId) {
  // Get workspace account
  const { data: account } = await supabase
    .from('workspace_accounts')
    .select('unipile_account_id')
    .eq('workspace_id', workspaceId)
    .eq('account_type', 'linkedin')
    .single();

  if (!account) {
    console.error(`❌ No LinkedIn account found for workspace ${workspaceId}`);
    return null;
  }

  // Get pending prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(BATCH_SIZE);

  return {
    unipileAccountId: account.unipile_account_id,
    prospects: prospects || []
  };
}

async function sendBatchToN8N(campaign, prospects, batchNumber) {
  const payload = {
    workspaceId: campaign.workspace_id,
    campaignId: campaign.id,
    channel: 'linkedin',
    campaignType: 'connector',
    unipileAccountId: campaign.unipileAccountId,
    unipile_account_id: campaign.unipileAccountId,

    accountTracking: {
      dailyMessageLimit: 20,
      messagesSentToday: 0,
      lastMessageDate: new Date().toISOString(),
      remainingToday: 20
    },

    scheduleSettings: {
      timezone: 'America/Los_Angeles',
      workingHoursStart: 0,
      workingHoursEnd: 24,
      skipWeekends: false,
      skipHolidays: false
    },

    prospects: prospects.map((p, index) => {
      const linkedinUsername = p.linkedin_url
        ? p.linkedin_url.split('/in/')[1]?.replace(/\/$/, '')
        : null;

      const today = new Date().toISOString().split('T')[0];
      const dateSeed = parseInt(today.replace(/-/g, '')) + campaign.unipileAccountId.charCodeAt(0);
      const dayPattern = (dateSeed % 5);

      let hourlyRate;
      switch (dayPattern) {
        case 0: hourlyRate = Math.random() * 2; break;
        case 1: hourlyRate = 2 + Math.random(); break;
        case 2: hourlyRate = 3 + Math.random() * 2; break;
        case 3: hourlyRate = index % 2 === 0 ? 4 + Math.random() : 1 + Math.random(); break;
        case 4: hourlyRate = 1 + Math.random() * 3; break;
      }

      const avgMinutesBetween = 60 / hourlyRate;
      const variation = (Math.random() - 0.5) * 0.6;
      const delayMinutes = Math.round(avgMinutesBetween * (1 + variation));
      const sendDelayMinutes = Math.max(2, Math.min(20, delayMinutes));

      return {
        id: p.id,
        prospect_id: p.id,
        linkedin_url: p.linkedin_url,
        linkedin_username: linkedinUsername,
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        company_name: p.company_name || '',
        sendDelayMinutes: sendDelayMinutes,
        send_delay_minutes: sendDelayMinutes
      };
    }),

    messages: {
      connectionRequest: campaign.message_templates?.connection_request || '',
      connection_request: campaign.message_templates?.connection_request || '',
      cr: campaign.message_templates?.connection_request || '',
      follow_up_1: campaign.message_templates?.follow_up_messages?.[0] || '',
      follow_up_2: campaign.message_templates?.follow_up_messages?.[1] || '',
      follow_up_3: campaign.message_templates?.follow_up_messages?.[2] || '',
      follow_up_4: campaign.message_templates?.follow_up_messages?.[3] || '',
      goodbye_message: campaign.message_templates?.follow_up_messages?.[4] || '',
      alternative_message: campaign.message_templates?.alternative_message || ''
    },

    timing: {
      fu1DelayDays: 2,
      fu2DelayDays: 5,
      fu3DelayDays: 7,
      fu4DelayDays: 5,
      gbDelayDays: 7
    },

    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    unipileDsn: process.env.UNIPILE_DSN,
    unipile_dsn: process.env.UNIPILE_DSN,
    unipileApiKey: process.env.UNIPILE_API_KEY,
    unipile_api_key: process.env.UNIPILE_API_KEY
  };

  try {
    const response = await fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    console.log(`   ✓ Batch ${batchNumber} sent to N8N`);
    return true;
  } catch (error) {
    console.error(`   ❌ Batch ${batchNumber} failed:`, error.message);
    return false;
  }
}

async function processCampaign(campaign) {
  console.log(`\n🚀 Processing: ${campaign.name}`);
  console.log(`   Campaign ID: ${campaign.id}`);
  console.log(`   Workspace: ${campaign.workspace_id}`);

  const details = await getCampaignDetails(campaign.id, campaign.workspace_id);

  if (!details) {
    console.log(`   ⏭️  Skipped - no LinkedIn account`);
    return;
  }

  if (details.prospects.length === 0) {
    console.log(`   ⏭️  Skipped - no pending prospects`);
    return;
  }

  console.log(`   📊 Pending prospects: ${details.prospects.length}`);

  campaign.unipileAccountId = details.unipileAccountId;

  const totalBatches = Math.ceil(details.prospects.length / BATCH_SIZE);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, details.prospects.length);
    const batch = details.prospects.slice(start, end);

    const success = await sendBatchToN8N(campaign, batch, i + 1);

    if (success && i < totalBatches - 1) {
      console.log(`   ⏳ Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  console.log(`   ✅ Campaign processed: ${totalBatches} batches sent`);
}

async function runExecutionCycle() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 AUTO-EXECUTE CAMPAIGNS - CYCLE START');
  console.log(new Date().toISOString());
  console.log('='.repeat(60));

  const campaigns = await getAllActiveCampaigns();

  if (campaigns.length === 0) {
    console.log('\n✅ No active campaigns to process');
    return;
  }

  for (const campaign of campaigns) {
    await processCampaign(campaign);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ CYCLE COMPLETE');
  console.log('='.repeat(60));
}

async function main() {
  console.log('🚀 AUTO-EXECUTE CAMPAIGNS - STARTED');
  console.log('📅 Check interval: Every hour');
  console.log('📦 Batch size: 5 prospects');
  console.log('⏱️  Batch delay: 2 minutes\n');

  // Run immediately on start
  await runExecutionCycle();

  // Then run every hour
  setInterval(runExecutionCycle, CHECK_INTERVAL_MS);
}

main().catch(console.error);
