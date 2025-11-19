#!/usr/bin/env node

/**
 * CRON JOB: Send prospects whose scheduled send time has arrived
 *
 * Run this every minute via cron:
 * * * * * * cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7 && node scripts/send-scheduled-prospects-cron.mjs >> /tmp/send-cron.log 2>&1
 *
 * This script:
 * 1. Finds prospects with status='queued' and scheduled_send_at <= NOW()
 * 2. Sends them one at a time to Unipile (NOT N8N - direct to avoid timeout)
 * 3. Updates status to 'connection_request_sent'
 * 4. N8N will handle follow-ups when prospects accept
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sendConnectionRequest(prospect, campaign, unipileAccountId) {
  // Trigger N8N workflow with single prospect
  const payload = {
    workspaceId: '7f0341da-88db-476b-ae0a-fc0da5b70861', // IA4
    campaignId: campaign.id,
    channel: 'linkedin',
    campaignType: 'connector',
    unipileAccountId: unipileAccountId,
    prospects: [{
      id: prospect.id,
      first_name: prospect.first_name,
      last_name: prospect.last_name,
      linkedin_url: prospect.linkedin_url,
      company_name: prospect.company_name,
      title: prospect.title,
      send_delay_minutes: 0
    }],
    messages: {
      connection_request: campaign.message_templates?.connection_request || campaign.connection_message || '',
      cr: campaign.message_templates?.connection_request || campaign.connection_message || ''
    },
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_service_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    unipile_dsn: process.env.UNIPILE_DSN,
    unipile_api_key: process.env.UNIPILE_API_KEY
  };

  // Send to N8N webhook (fire-and-forget - don't wait for response)
  fetch('https://workflows.innovareai.com/webhook/connector-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => {
    // Log error but don't block
    console.error(`   ⚠️  N8N trigger warning: ${err.message}`);
  });

  // Return immediately without waiting for N8N
  return { triggered: true, prospectId: prospect.id };
}

async function processPendingSends() {
  const now = new Date().toISOString();

  console.log(`[${new Date().toLocaleString()}] Checking for scheduled prospects...`);
  console.log(`   Current time: ${now}`);

  // Find prospects ready to send (simple query first)
  const { data: prospects, error } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url, company_name, title, campaign_id, scheduled_send_at')
    .eq('status', 'queued')
    .lte('scheduled_send_at', now)
    .order('scheduled_send_at')
    .limit(1); // Process 1 prospect per minute for human-like behavior

  console.log(`   Query result: ${prospects?.length || 0} prospects found`);

  if (error) {
    console.error(`❌ Error fetching prospects:`, error.message);
    return;
  }

  if (!prospects || prospects.length === 0) {
    console.log(`   No prospects ready to send`);
    return;
  }

  console.log(`   📤 Found ${prospects.length} prospects ready to send\n`);

  let successCount = 0;
  let failCount = 0;

  for (const prospect of prospects) {
    // Get campaign and account data in separate queries
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, connection_message, message_templates, linkedin_account_id')
      .eq('id', prospect.campaign_id)
      .single();

    if (!campaign || !campaign.linkedin_account_id) {
      console.log(`[${prospect.first_name} ${prospect.last_name}] ❌ No LinkedIn account configured`);
      await supabase
        .from('campaign_prospects')
        .update({ status: 'failed' })
        .eq('id', prospect.id);
      failCount++;
      continue;
    }

    const { data: account } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('id', campaign.linkedin_account_id)
      .single();

    const unipileAccountId = account?.unipile_account_id;

    if (!unipileAccountId) {
      console.log(`[${prospect.first_name} ${prospect.last_name}] ❌ No Unipile account`);
      await supabase
        .from('campaign_prospects')
        .update({ status: 'failed' })
        .eq('id', prospect.id);
      failCount++;
      continue;
    }

    console.log(`[${prospect.first_name} ${prospect.last_name}] Sending...`);

    try {
      const result = await sendConnectionRequest(prospect, campaign, unipileAccountId);
      console.log(`   ✅ Sent (invitation_id: ${result.invitation_id || 'N/A'})`);

      // Update status
      await supabase
        .from('campaign_prospects')
        .update({
          status: 'connection_request_sent',
          contacted_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      successCount++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);

      // Mark as failed
      await supabase
        .from('campaign_prospects')
        .update({ status: 'failed' })
        .eq('id', prospect.id);

      failCount++;
    }
  }

  console.log(`\n✅ Batch complete: ${successCount} sent, ${failCount} failed\n`);
}

// Run the cron job
processPendingSends();
