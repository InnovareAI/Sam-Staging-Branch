#!/usr/bin/env node
/**
 * Queue Processor Loop - Continuous processing
 *
 * Runs continuously, checking for overdue messages every 2 minutes.
 * Use this when Netlify cron jobs aren't working.
 *
 * Usage: node scripts/js/queue-processor-loop.mjs
 *
 * Ctrl+C to stop
 */

import { createClient } from '@supabase/supabase-js';

// Production credentials
const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';
const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
const RATE_LIMIT_DELAY = 30 * 1000; // 30 seconds between messages

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
  // CORRECT ENDPOINT: /api/v1/chats (NOT /api/v1/messages/send which doesn't exist)
  const url = `https://${UNIPILE_DSN}/api/v1/chats`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': UNIPILE_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      account_id: unipileAccountId,
      attendees_ids: [providerId],  // Array of provider_ids
      text: text
    })
  });

  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

async function processOverdue() {
  const now = new Date();
  console.log(`\n[${now.toISOString()}] Checking for overdue messages...`);

  // Get overdue messages (max 5 per cycle to avoid overloading)
  const { data: pendingItems, error } = await supabase
    .from('send_queue')
    .select('id, campaign_id, prospect_id, linkedin_user_id, message, message_type, scheduled_for')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(5);

  if (error) {
    console.error('❌ Error fetching queue:', error.message);
    return;
  }

  if (!pendingItems || pendingItems.length === 0) {
    console.log('✅ No overdue messages');
    return;
  }

  console.log(`📋 Found ${pendingItems.length} overdue messages`);

  let sent = 0, failed = 0;

  for (const item of pendingItems) {
    // Get campaign with LinkedIn account
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, name, linkedin_account_id')
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

    // Get prospect
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select('first_name, last_name')
      .eq('id', item.prospect_id)
      .single();

    console.log(`  📤 ${prospect?.first_name || 'Unknown'} ${prospect?.last_name || ''} (${item.message_type})`);

    if (!account?.unipile_account_id) {
      console.log(`     ❌ No Unipile account`);
      await supabase
        .from('send_queue')
        .update({ status: 'failed', error_message: 'No Unipile account', updated_at: new Date().toISOString() })
        .eq('id', item.id);
      failed++;
      continue;
    }

    try {
      let result;
      if (item.message_type === 'connection_request') {
        result = await sendConnectionRequest(account.unipile_account_id, item.linkedin_user_id, item.message);
      } else {
        result = await sendMessage(account.unipile_account_id, item.linkedin_user_id, item.message);
      }

      if (result.ok) {
        console.log(`     ✅ Sent via ${account.account_name}`);
        await supabase
          .from('send_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', item.id);

        const newStatus = item.message_type === 'connection_request' ? 'cr_sent' : 'follow_up_sent';
        await supabase
          .from('campaign_prospects')
          .update({ status: newStatus, last_action_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', item.prospect_id);

        sent++;
      } else {
        console.log(`     ❌ API Error: ${result.status}`);
        await supabase
          .from('send_queue')
          .update({ status: 'failed', error_message: JSON.stringify(result.data).substring(0, 500), updated_at: new Date().toISOString() })
          .eq('id', item.id);
        failed++;
      }
    } catch (err) {
      console.log(`     ❌ Exception: ${err.message}`);
      await supabase
        .from('send_queue')
        .update({ status: 'failed', error_message: err.message.substring(0, 500), updated_at: new Date().toISOString() })
        .eq('id', item.id);
      failed++;
    }

    // Rate limit
    if (pendingItems.indexOf(item) < pendingItems.length - 1) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY));
    }
  }

  console.log(`  ✅ Sent: ${sent}, ❌ Failed: ${failed}`);
}

async function main() {
  console.log('🚀 Queue Processor Loop Started');
  console.log(`   Checking every ${CHECK_INTERVAL / 1000}s`);
  console.log('   Press Ctrl+C to stop\n');

  // Initial check
  await processOverdue();

  // Set up interval
  setInterval(processOverdue, CHECK_INTERVAL);
}

main().catch(console.error);
