#!/usr/bin/env node
/**
 * Check all LinkedIn accounts running campaigns
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllAccounts() {
  console.log('🔍 Checking all LinkedIn accounts with active campaigns...\n');

  // Get all active campaigns with their LinkedIn accounts
  const { data: campaigns, error: cError } = await supabase
    .from('campaigns')
    .select('id, name, status, linkedin_account_id, timezone, country_code, workspace_id')
    .in('status', ['active', 'running'])
    .not('linkedin_account_id', 'is', null);

  if (cError) {
    console.log('Error fetching campaigns:', cError.message);
    return;
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('No active campaigns with LinkedIn accounts found');
    return;
  }

  // Group campaigns by LinkedIn account
  const accountMap = new Map();
  for (const c of campaigns) {
    if (!accountMap.has(c.linkedin_account_id)) {
      accountMap.set(c.linkedin_account_id, []);
    }
    accountMap.get(c.linkedin_account_id).push(c);
  }

  console.log(`Found ${accountMap.size} LinkedIn accounts with active campaigns\n`);
  console.log('='.repeat(70));

  // Get account details
  const accountIds = Array.from(accountMap.keys());
  const { data: accounts } = await supabase
    .from('user_unipile_accounts')
    .select('id, account_name, connection_status, unipile_account_id, platform')
    .in('id', accountIds);

  const accountLookup = new Map();
  if (accounts) {
    for (const a of accounts) {
      accountLookup.set(a.id, a);
    }
  }

  // Get today's date for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Check each account
  for (const [accountId, accountCampaigns] of accountMap) {
    const account = accountLookup.get(accountId);

    console.log(`\n📱 ACCOUNT: ${account?.account_name || 'Unknown'}`);
    console.log(`   ID: ${accountId}`);
    console.log(`   Status: ${account?.connection_status || 'Unknown'}`);
    console.log(`   Unipile ID: ${account?.unipile_account_id || 'N/A'}`);

    // Get queue stats for this account
    const { data: queueItems } = await supabase
      .from('send_queue')
      .select('id, status, scheduled_for, sent_at')
      .eq('linkedin_account_id', accountId);

    if (queueItems) {
      const stats = queueItems.reduce((acc, q) => {
        acc[q.status] = (acc[q.status] || 0) + 1;
        return acc;
      }, {});

      // Count today's sends
      const todaySent = queueItems.filter(q =>
        q.status === 'sent' &&
        q.sent_at &&
        q.sent_at >= todayISO
      ).length;

      console.log(`\n   📊 Queue Stats:`);
      Object.entries(stats).forEach(([s, c]) => {
        console.log(`      ${s}: ${c}`);
      });
      console.log(`      Total: ${queueItems.length}`);
      console.log(`\n   📅 Today's sends: ${todaySent}/25`);
    }

    console.log(`\n   📋 Active Campaigns (${accountCampaigns.length}):`);
    for (const camp of accountCampaigns) {
      // Get prospect stats for this campaign
      const { data: prospects } = await supabase
        .from('campaign_prospects')
        .select('status')
        .eq('campaign_id', camp.id);

      const prospectStats = prospects ? prospects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {}) : {};

      console.log(`      • ${camp.name}`);
      console.log(`        Status: ${camp.status} | TZ: ${camp.timezone || 'N/A'} | Country: ${camp.country_code || 'N/A'}`);
      if (Object.keys(prospectStats).length > 0) {
        const approved = prospectStats['approved'] || 0;
        const sent = prospectStats['sent'] || prospectStats['connection_sent'] || 0;
        const pending = prospectStats['pending'] || 0;
        console.log(`        Prospects: ${approved} approved, ${sent} sent, ${pending} pending`);
      }
    }

    console.log('\n' + '-'.repeat(70));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total LinkedIn accounts: ${accountMap.size}`);
  console.log(`Total active campaigns: ${campaigns.length}`);

  // Check for any disconnected accounts
  const disconnected = accounts ? accounts.filter(a => a.connection_status !== 'OK' && a.connection_status !== 'connected') : [];
  if (disconnected.length > 0) {
    console.log(`\n⚠️  DISCONNECTED ACCOUNTS:`);
    disconnected.forEach(a => {
      console.log(`   - ${a.account_name}: ${a.connection_status}`);
    });
  }
}

checkAllAccounts().catch(console.error);
