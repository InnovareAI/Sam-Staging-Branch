#!/usr/bin/env node
/**
 * Direct Queue Processor - Bypasses Netlify Cron
 *
 * Use this when cron jobs aren't firing.
 * Processes pending send_queue messages directly using Supabase + Unipile APIs.
 *
 * Usage: node scripts/js/direct-queue-processor.mjs [--limit=10] [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';

// Production credentials
const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 5;

console.log('🚀 Direct Queue Processor');
console.log(`   Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
console.log(`   Limit: ${limit} messages\n`);

async function sendConnectionRequest(unipileAccountId, providerId, message) {
  const url = `https://${UNIPILE_DSN}/api/v1/users/invite`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      account_id: unipileAccountId,
      provider_id: providerId,
      message: message || ''
    })
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function sendMessage(unipileAccountId, providerId, text) {
  const url = `https://${UNIPILE_DSN}/api/v1/messages/send`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      account_id: unipileAccountId,
      attendee_provider_id: providerId,
      text: text
    })
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function processQueue() {
  // Get pending messages ordered by scheduled_for
  const now = new Date().toISOString();
  const { data: pendingItems, error } = await supabase
    .from('send_queue')
    .select(`
      id,
      campaign_id,
      prospect_id,
      linkedin_user_id,
      message,
      message_type,
      scheduled_for,
      requires_connection
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('❌ Error fetching queue:', error.message);
    return;
  }

  console.log(`📋 Found ${pendingItems?.length || 0} messages ready to send\n`);

  if (!pendingItems || pendingItems.length === 0) {
    console.log('✅ No pending messages to process');
    return;
  }

  let sent = 0, failed = 0, skipped = 0;

  for (const item of pendingItems) {
    // Get campaign with LinkedIn account
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, linkedin_account_id, workspace_id')
      .eq('id', item.campaign_id)
      .single();

    // Get LinkedIn account
    let account = null;
    if (campaign?.linkedin_account_id) {
      const { data: acc } = await supabase
        .from('user_unipile_accounts')
        .select('id, unipile_account_id, account_name')
        .eq('id', campaign.linkedin_account_id)
        .single();
      account = acc;
    }

    // Get prospect details
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, linkedin_url, status')
      .eq('id', item.prospect_id)
      .single();

    console.log(`\n📤 Processing: ${prospect?.first_name || 'Unknown'} ${prospect?.last_name || ''}`);
    console.log(`   Campaign: ${campaign?.name || 'Unknown'}`);
    console.log(`   Type: ${item.message_type}`);
    console.log(`   Scheduled: ${item.scheduled_for}`);
    console.log(`   Provider ID: ${item.linkedin_user_id}`);

    if (isDryRun) {
      console.log(`   Account: ${account?.account_name || 'NOT FOUND'}`);
      console.log('   [DRY RUN] Would send message');
      skipped++;
      continue;
    }

    if (!account?.unipile_account_id) {
      console.log('   ❌ No Unipile account found for campaign');
      console.log(`   Campaign linkedin_account_id: ${campaign?.linkedin_account_id || 'null'}`);
      await supabase
        .from('send_queue')
        .update({
          status: 'failed',
          error_message: 'No Unipile account found for campaign',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);
      failed++;
      continue;
    }

    console.log(`   Using account: ${account.account_name}`);

    let result;
    try {
      if (item.message_type === 'connection_request') {
        result = await sendConnectionRequest(
          account.unipile_account_id,
          item.linkedin_user_id,
          item.message
        );
      } else {
        result = await sendMessage(
          account.unipile_account_id,
          item.linkedin_user_id,
          item.message
        );
      }

      if (result.ok) {
        console.log('   ✅ Sent successfully');

        // Update send_queue
        await supabase
          .from('send_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        // Update prospect status
        const newStatus = item.message_type === 'connection_request' ? 'cr_sent' : 'follow_up_sent';
        await supabase
          .from('campaign_prospects')
          .update({
            status: newStatus,
            last_action_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.prospect_id);

        sent++;
      } else {
        console.log(`   ❌ API Error: ${result.status}`);
        console.log(`   Response: ${JSON.stringify(result.data)}`);

        await supabase
          .from('send_queue')
          .update({
            status: 'failed',
            error_message: JSON.stringify(result.data).substring(0, 500),
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        failed++;
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
      await supabase
        .from('send_queue')
        .update({
          status: 'failed',
          error_message: err.message.substring(0, 500),
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);
      failed++;
    }

    // Rate limit: wait 30 seconds between messages
    if (pendingItems.indexOf(item) < pendingItems.length - 1) {
      console.log('   ⏳ Waiting 30s (rate limit)...');
      await new Promise(r => setTimeout(r, 30000));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Sent: ${sent}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);

  // Check remaining
  const { count } = await supabase
    .from('send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  console.log(`\n📊 Remaining in queue: ${count}`);
}

processQueue().catch(console.error);
