#!/usr/bin/env node

/**
 * Execute campaigns in small batches to avoid N8N concurrent execution limits
 * Sends 5 prospects at a time with 2-minute delays between batches
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: join(__dirname, '../.env.local') });

const BATCH_SIZE = 1;  // Send 1 prospect per batch (for testing)
const BATCH_DELAY_MS = 180000;  // 3 minutes between batches (to see N8N process each one)

const campaigns = [
  {
    name: 'Charissa (IA4)',
    campaignId: '683f9214-8a3f-4015-98fe-aa3ae76a9ebe',
    workspaceId: '7f0341da-88db-476b-ae0a-fc0da5b70861',
    unipileAccountId: '4nt1J-blSnGUPBjH2Nfjpg',
    message: "Hi {first_name},\n\nI work with early-stage founders on scaling outbound without burning time or budget on traditional sales hires. Saw that you're building {company_name} and thought it might be worth connecting.\n\nOpen to it?"
  },
  {
    name: 'Michelle (IA2)',
    campaignId: '9fcfcab0-7007-4628-b49b-1636ba5f781f',
    workspaceId: '04666209-fce8-4d71-8eaf-01278edfc73b',
    unipileAccountId: 'MT39bAEDTJ6e_ZPY337UgQ',
    message: "Hi {first_name},\n\nI work with early-stage founders on scaling outbound without burning time or budget on traditional sales hires. Saw that you're building {company_name} and thought it might be worth connecting.\n\nOpen to it?"
  }
];

// Verify environment variables are loaded
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Missing environment variables!');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendBatch(campaign, prospects, templates, batchNumber, totalBatches) {
  console.log(`\\n📦 Batch ${batchNumber}/${totalBatches} - ${prospects.length} prospects`);

  const payload = {
    workspaceId: campaign.workspaceId,
    campaignId: campaign.campaignId,
    channel: 'linkedin',
    campaignType: 'connector',
    unipileAccountId: campaign.unipileAccountId,
    unipile_account_id: campaign.unipileAccountId,  // N8N expects snake_case

    accountTracking: {
      dailyMessageLimit: 20,
      messagesSentToday: 0,
      lastMessageDate: new Date().toISOString(),
      remainingToday: 20
    },

    scheduleSettings: {
      timezone: 'America/Los_Angeles',
      workingHoursStart: 5,
      workingHoursEnd: 18,
      skipWeekends: false,
      skipHolidays: false
    },

    prospects: prospects.map((p, index) => {
      const linkedinUsername = p.linkedin_url
        ? p.linkedin_url.split('/in/')[1]?.replace(/\/$/, '')
        : null;

      // PRODUCTION-GRADE HUMAN RANDOMIZATION
      // Generate day-specific pattern
      const today = new Date().toISOString().split('T')[0];
      const dateSeed = parseInt(today.replace(/-/g, '')) + campaign.unipileAccountId.charCodeAt(0);
      const dayPattern = (dateSeed % 5);

      let hourlyRate;
      switch (dayPattern) {
        case 0: hourlyRate = Math.random() * 2; break;        // Slow: 0-2 msg/hr
        case 1: hourlyRate = 2 + Math.random(); break;        // Medium: 2-3 msg/hr
        case 2: hourlyRate = 3 + Math.random() * 2; break;    // Busy: 3-5 msg/hr
        case 3: hourlyRate = index % 2 === 0 ? 4 + Math.random() : 1 + Math.random(); break; // Mixed
        case 4: hourlyRate = 1 + Math.random() * 3; break;    // Variable: 1-4 msg/hr
      }

      const avgMinutesBetween = 60 / hourlyRate;
      const variation = (Math.random() - 0.5) * 0.6; // ±30%
      const delayMinutes = Math.round(avgMinutesBetween * (1 + variation));
      const sendDelayMinutes = index === 0 ? 0 : Math.max(2, Math.min(20, delayMinutes));

      return {
        id: p.id,
        prospectId: p.id,
        campaignId: campaign.campaignId,
        firstName: p.first_name,
        first_name: p.first_name,  // N8N expects snake_case
        lastName: p.last_name,
        last_name: p.last_name,  // N8N expects snake_case
        linkedinUrl: p.linkedin_url,
        linkedin_url: p.linkedin_url,  // N8N expects snake_case
        linkedinUsername: linkedinUsername,
        linkedin_username: linkedinUsername,  // N8N expects snake_case
        linkedinUserId: p.linkedin_user_id,
        linkedin_user_id: p.linkedin_user_id,  // N8N expects snake_case
        companyName: p.company_name,
        company_name: p.company_name,  // N8N expects snake_case
        title: p.title,
        sendDelayMinutes: sendDelayMinutes,  // Human-randomized delays (2-20 min)
        send_delay_minutes: sendDelayMinutes  // N8N expects snake_case
      };
    }),

    messages: {
      // Connection request
      connectionRequest: templates.connection_request,
      connection_request: templates.connection_request,
      cr: templates.connection_request,

      // Follow-up messages (N8N expects snake_case)
      follow_up_1: templates.follow_up_messages?.[0] || '',
      follow_up_2: templates.follow_up_messages?.[1] || '',
      follow_up_3: templates.follow_up_messages?.[2] || '',
      follow_up_4: templates.follow_up_messages?.[3] || '',
      goodbye_message: templates.follow_up_messages?.[4] || '',

      // Alternative/acceptance message
      alternative_message: templates.alternative_message || templates.follow_up_messages?.[0] || ''
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
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,  // N8N expects snake_case
    supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,  // N8N expects snake_case
    unipileDsn: process.env.UNIPILE_DSN,  // Don't add https:// here
    unipile_dsn: process.env.UNIPILE_DSN,  // N8N expects snake_case and adds https://
    unipileApiKey: process.env.UNIPILE_API_KEY,
    unipile_api_key: process.env.UNIPILE_API_KEY  // N8N expects snake_case
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

    console.log(`   ✓ N8N webhook accepted batch ${batchNumber}`);

    // Update prospect statuses - MUST USE .select() TO VERIFY
    const prospectIds = prospects.map(p => p.id);
    const { data, error: updateError } = await supabase
      .from('campaign_prospects')
      .update({ status: 'queued_in_n8n' })
      .in('id', prospectIds)
      .select('id');  // CRITICAL: Returns updated rows to verify success

    if (updateError) {
      console.error(`❌ Database update failed for batch ${batchNumber}:`, updateError);
      console.error(`   Prospects sent to N8N but NOT marked as queued!`);
      return false;
    }

    if (!data || data.length === 0) {
      console.error(`❌ Database update returned 0 rows for batch ${batchNumber}`);
      console.error(`   Expected ${prospectIds.length} rows updated`);
      console.error(`   Prospects sent to N8N but NOT marked as queued!`);
      return false;
    }

    if (data.length !== prospectIds.length) {
      console.error(`⚠️  Partial database update for batch ${batchNumber}`);
      console.error(`   Expected: ${prospectIds.length}, Updated: ${data.length}`);
      return false;
    }

    console.log(`✅ Batch ${batchNumber} complete: ${data.length} prospects queued`);
    return true;
  } catch (error) {
    console.error(`❌ Batch ${batchNumber} failed:`, error.message);
    return false;
  }
}

async function executeCampaign(campaign) {
  console.log(`\\n🚀 Executing campaign: ${campaign.name}`);
  console.log(`   Campaign ID: ${campaign.campaignId}`);

  // FETCH MESSAGE TEMPLATES FROM DATABASE
  const { data: campaignData, error: campaignError } = await supabase
    .from('campaigns')
    .select('message_templates')
    .eq('id', campaign.campaignId)
    .single();

  if (campaignError || !campaignData) {
    console.error(`❌ Failed to fetch campaign templates:`, campaignError);
    return;
  }

  const templates = campaignData.message_templates;
  console.log(`📝 Loaded message templates from database`);

  // Get pending prospects - LIMIT TO 5 FOR TESTING
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, email, company_name, title, linkedin_url, linkedin_user_id')
    .eq('campaign_id', campaign.campaignId)
    .eq('status', 'pending')
    .order('created_at')
    .limit(5);  // TESTING: Send 5 connection requests

  if (error) {
    console.error(`❌ Failed to fetch prospects:`, error);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log(`⚠️  No pending prospects found`);
    return;
  }

  console.log(`📊 Total prospects: ${prospects.length}`);

  // Split into batches
  const batches = [];
  for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
    batches.push(prospects.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Batches: ${batches.length} (${BATCH_SIZE} prospects each)`);

  // Track results
  let successCount = 0;
  let failCount = 0;
  let totalProspectsQueued = 0;

  // Send batches with delays
  for (let i = 0; i < batches.length; i++) {
    const success = await sendBatch(campaign, batches[i], templates, i + 1, batches.length);

    if (success) {
      successCount++;
      totalProspectsQueued += batches[i].length;
    } else {
      failCount++;
    }

    // Wait between batches (except last one)
    if (i < batches.length - 1) {
      const waitMinutes = BATCH_DELAY_MS / 60000;
      console.log(`⏳ Waiting ${waitMinutes} minutes before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Update campaign status
  await supabase
    .from('campaigns')
    .update({ status: 'active' })
    .eq('id', campaign.campaignId);

  console.log(`\\n${'='.repeat(60)}`);
  console.log(`✅ Campaign ${campaign.name} COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`   Total prospects: ${prospects.length}`);
  console.log(`   Successful batches: ${successCount}/${batches.length}`);
  console.log(`   Failed batches: ${failCount}/${batches.length}`);
  console.log(`   Prospects queued: ${totalProspectsQueued}/${prospects.length}`);

  if (failCount > 0) {
    console.log(`\\n⚠️  ${failCount} batches failed - some prospects NOT queued`);
    console.log(`   Run this script again to retry failed prospects`);
  }

  console.log(`${'='.repeat(60)}\\n`);
}

// Execute all campaigns
console.log('🎯 Batched Campaign Execution');
console.log(`   Batch size: ${BATCH_SIZE} prospects`);
console.log(`   Batch delay: ${BATCH_DELAY_MS / 60000} minutes\\n`);

for (const campaign of campaigns) {
  await executeCampaign(campaign);
}

console.log('\\n🎉 All campaigns executed!');
console.log('Monitor at: https://workflows.innovareai.com');
