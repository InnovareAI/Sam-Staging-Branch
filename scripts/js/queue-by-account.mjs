#!/usr/bin/env node
/**
 * Check send queue stats by LinkedIn account
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get all queue items with campaign_id
  const { data: queue, error } = await supabase
    .from('send_queue')
    .select('status, campaign_id, sent_at, scheduled_for');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  // Get campaigns with their LinkedIn account IDs
  const campaignIds = [...new Set(queue.map(q => q.campaign_id).filter(Boolean))];
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, linkedin_account_id')
    .in('id', campaignIds);

  const campaignMap = new Map();
  const accountIds = new Set();
  if (campaigns) {
    for (const c of campaigns) {
      campaignMap.set(c.id, c);
      if (c.linkedin_account_id) accountIds.add(c.linkedin_account_id);
    }
  }

  // Get account names
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name')
    .in('id', Array.from(accountIds));

  const nameMap = new Map();
  if (accounts) {
    for (const a of accounts) {
      nameMap.set(a.id, a.account_name);
    }
  }

  // Today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Group by account
  const byAccount = {};
  for (const q of queue) {
    const campaign = campaignMap.get(q.campaign_id);
    const accountId = campaign?.linkedin_account_id;
    const name = nameMap.get(accountId) || accountId || 'Unknown';
    if (!byAccount[name]) {
      byAccount[name] = { pending: 0, sent: 0, failed: 0, todaySent: 0 };
    }
    if (q.status === 'pending') byAccount[name].pending++;
    else if (q.status === 'sent') {
      byAccount[name].sent++;
      if (q.sent_at && q.sent_at >= todayISO) {
        byAccount[name].todaySent++;
      }
    }
    else if (q.status === 'failed') byAccount[name].failed++;
  }

  console.log('SEND QUEUE BY ACCOUNT:');
  console.log('='.repeat(70));
  console.log('');

  const sortedAccounts = Object.entries(byAccount).sort((a, b) => {
    // Sort by pending count (highest first)
    return b[1].pending - a[1].pending;
  });

  for (const [name, stats] of sortedAccounts) {
    const total = stats.pending + stats.sent + stats.failed;
    console.log(`📱 ${name}`);
    console.log(`   Pending: ${stats.pending} | Sent: ${stats.sent} | Failed: ${stats.failed} | Total: ${total}`);
    console.log(`   Today's sends: ${stats.todaySent}/25 daily limit`);
    console.log('');
  }

  // Summary
  const totalPending = Object.values(byAccount).reduce((sum, s) => sum + s.pending, 0);
  const totalSent = Object.values(byAccount).reduce((sum, s) => sum + s.sent, 0);
  const totalFailed = Object.values(byAccount).reduce((sum, s) => sum + s.failed, 0);
  const totalToday = Object.values(byAccount).reduce((sum, s) => sum + s.todaySent, 0);

  console.log('='.repeat(70));
  console.log('TOTALS:');
  console.log(`   Pending: ${totalPending} | Sent: ${totalSent} | Failed: ${totalFailed}`);
  console.log(`   Total sent today (all accounts): ${totalToday}`);
}

main().catch(console.error);
