#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function investigateSebastian() {
  console.log('=== SEBASTIAN HENKEL CAMPAIGN INVESTIGATION ===\n');
  console.log(`Investigation Time: ${new Date().toISOString()}\n`);

  // 1. Find Sebastian's LinkedIn account
  console.log('1. FINDING SEBASTIAN\'S LINKEDIN ACCOUNT...\n');
  const { data: accounts, error: accountsError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .ilike('name', '%sebastian%');

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return;
  }

  console.log(`Found ${accounts?.length || 0} account(s):`);
  accounts?.forEach(acc => {
    console.log(`  - ID: ${acc.id}`);
    console.log(`    Name: ${acc.name}`);
    console.log(`    Provider: ${acc.provider_name}`);
    console.log(`    Workspace: ${acc.workspace_id}`);
    console.log(`    Status: ${acc.status}`);
    console.log(`    Rate Limited Until: ${acc.rate_limited_until || 'N/A'}`);
    console.log(`    Last Error: ${acc.last_error_message || 'N/A'}\n`);
  });

  if (!accounts || accounts.length === 0) {
    console.log('No LinkedIn account found for Sebastian. Exiting.\n');
    return;
  }

  const sebastianAccountId = accounts[0].id;

  // 2. Find campaigns using this account
  console.log('\n2. FINDING CAMPAIGNS USING THIS ACCOUNT...\n');
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('linkedin_account_id', sebastianAccountId);

  if (campaignsError) {
    console.error('Error fetching campaigns:', campaignsError);
    return;
  }

  console.log(`Found ${campaigns?.length || 0} campaign(s):`);
  campaigns?.forEach(camp => {
    console.log(`  - Campaign ID: ${camp.id}`);
    console.log(`    Name: ${camp.name}`);
    console.log(`    Status: ${camp.status}`);
    console.log(`    Country: ${camp.country}`);
    console.log(`    Start Date: ${camp.start_date}`);
    console.log(`    Business Hours: ${camp.business_hours_start || 'N/A'} - ${camp.business_hours_end || 'N/A'}`);
    console.log(`    Messages/Day Limit: ${camp.messages_per_day_limit || 'N/A'}`);
    console.log(`    Timezone: ${camp.timezone || 'N/A'}`);
    console.log(`    Paused At: ${camp.paused_at || 'N/A'}\n`);
  });

  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found for this account.\n');
    return;
  }

  const campaignIds = campaigns.map(c => c.id);

  // 3. Check send_queue for pending items
  console.log('\n3. CHECKING SEND_QUEUE FOR PENDING ITEMS...\n');
  const { data: queueItems, error: queueError } = await supabase
    .from('send_queue')
    .select('*')
    .in('campaign_id', campaignIds)
    .eq('status', 'pending')
    .order('scheduled_send_time', { ascending: true });

  if (queueError) {
    console.error('Error fetching queue items:', queueError);
    return;
  }

  console.log(`Found ${queueItems?.length || 0} pending queue item(s):`);
  queueItems?.slice(0, 10).forEach(item => {
    console.log(`  - Queue ID: ${item.id}`);
    console.log(`    Campaign ID: ${item.campaign_id}`);
    console.log(`    Prospect: ${item.prospect_name}`);
    console.log(`    Scheduled: ${item.scheduled_send_time}`);
    console.log(`    Retry Count: ${item.retry_count || 0}`);
    console.log(`    Last Error: ${item.last_error || 'N/A'}\n`);
  });

  if (queueItems && queueItems.length > 10) {
    console.log(`  ... and ${queueItems.length - 10} more pending items\n`);
  }

  // 4. Check messages sent today
  console.log('\n4. CHECKING MESSAGES SENT TODAY...\n');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { data: sentToday, error: sentError } = await supabase
    .from('send_queue')
    .select('*')
    .in('campaign_id', campaignIds)
    .eq('status', 'sent')
    .gte('sent_at', todayISO);

  if (sentError) {
    console.error('Error fetching sent messages:', sentError);
    return;
  }

  console.log(`Messages sent today (since ${todayISO}): ${sentToday?.length || 0}`);
  if (sentToday && sentToday.length > 0) {
    sentToday.forEach(item => {
      console.log(`  - Sent at: ${item.sent_at}`);
      console.log(`    Prospect: ${item.prospect_name}`);
      console.log(`    Campaign: ${item.campaign_id}\n`);
    });
  }

  // 5. Check failed messages today
  console.log('\n5. CHECKING FAILED MESSAGES TODAY...\n');
  const { data: failedToday, error: failedError } = await supabase
    .from('send_queue')
    .select('*')
    .in('campaign_id', campaignIds)
    .eq('status', 'failed')
    .gte('updated_at', todayISO);

  if (failedError) {
    console.error('Error fetching failed messages:', failedError);
    return;
  }

  console.log(`Messages failed today: ${failedToday?.length || 0}`);
  if (failedToday && failedToday.length > 0) {
    failedToday.forEach(item => {
      console.log(`  - Failed at: ${item.updated_at}`);
      console.log(`    Prospect: ${item.prospect_name}`);
      console.log(`    Error: ${item.last_error}`);
      console.log(`    Retry Count: ${item.retry_count || 0}\n`);
    });
  }

  // 6. Check rate limit status
  console.log('\n6. RATE LIMIT STATUS CHECK...\n');
  const account = accounts[0];
  if (account.rate_limited_until) {
    const rateLimitExpiry = new Date(account.rate_limited_until);
    const now = new Date();
    const isRateLimited = rateLimitExpiry > now;

    console.log(`Rate Limited: ${isRateLimited ? 'YES' : 'NO'}`);
    console.log(`Rate Limited Until: ${account.rate_limited_until}`);

    if (isRateLimited) {
      const hoursRemaining = Math.ceil((rateLimitExpiry - now) / (1000 * 60 * 60));
      console.log(`Hours Remaining: ${hoursRemaining}`);
      console.log('\n⚠️  ACCOUNT IS CURRENTLY RATE LIMITED!\n');
    }
  } else {
    console.log('Rate Limited: NO');
    console.log('Rate Limited Until: N/A\n');
  }

  // 7. Check business hours
  console.log('\n7. BUSINESS HOURS CHECK...\n');
  campaigns?.forEach(camp => {
    console.log(`Campaign: ${camp.name}`);
    console.log(`  Country: ${camp.country || 'Not set'}`);
    console.log(`  Timezone: ${camp.timezone || 'Not set'}`);
    console.log(`  Business Hours: ${camp.business_hours_start || 'N/A'} - ${camp.business_hours_end || 'N/A'}`);

    // Check current time in campaign timezone
    if (camp.timezone) {
      const now = new Date();
      const timeInTz = now.toLocaleString('en-US', {
        timeZone: camp.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      console.log(`  Current time in ${camp.timezone}: ${timeInTz}`);

      if (camp.business_hours_start && camp.business_hours_end) {
        const currentHour = parseInt(timeInTz.split(':')[0]);
        const startHour = parseInt(camp.business_hours_start.split(':')[0]);
        const endHour = parseInt(camp.business_hours_end.split(':')[0]);
        const inBusinessHours = currentHour >= startHour && currentHour < endHour;
        console.log(`  In Business Hours: ${inBusinessHours ? 'YES' : 'NO'}`);
      }
    }
    console.log('');
  });

  // 8. Summary and diagnosis
  console.log('\n=== DIAGNOSIS SUMMARY ===\n');

  const issues = [];

  if (account.rate_limited_until && new Date(account.rate_limited_until) > new Date()) {
    issues.push('❌ ACCOUNT IS RATE LIMITED');
  }

  if (campaigns?.every(c => c.status !== 'active')) {
    issues.push('❌ NO ACTIVE CAMPAIGNS');
  }

  if (!queueItems || queueItems.length === 0) {
    issues.push('❌ NO PENDING QUEUE ITEMS');
  }

  if (account.status !== 'active') {
    issues.push(`❌ ACCOUNT STATUS: ${account.status}`);
  }

  if (issues.length === 0) {
    console.log('✅ No obvious issues found. May be business hours restriction.');
  } else {
    console.log('Issues found:');
    issues.forEach(issue => console.log(`  ${issue}`));
  }

  console.log('\n=== END OF INVESTIGATION ===\n');
}

investigateSebastian().catch(console.error);
