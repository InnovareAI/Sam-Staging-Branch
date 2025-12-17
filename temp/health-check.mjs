#!/usr/bin/env node

const SUPABASE_URL = "https://latxadqrvrrrcvkktrog.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ";

async function query(endpoint, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

  const response = await fetch(url.toString(), {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact'
    }
  });

  const contentRange = response.headers.get('content-range');
  const count = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
  const data = await response.json();
  
  // Handle both array and object responses
  const dataArray = Array.isArray(data) ? data : [];
  
  return { count, data: dataArray };
}

console.log('==========================================');
console.log('SAM MESSAGING PLATFORM - HEALTH CHECK');
console.log(`Run Time: ${new Date().toISOString()}`);
console.log('==========================================\n');

// 1. Queue Status
console.log('1. SEND QUEUE STATUS');
console.log('-------------------');

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0] + 'T00:00:00';

const overdue = await query('send_queue', {
  'status': 'eq.pending',
  'scheduled_send_time': `lt.${now}`
});

const pending = await query('send_queue', {
  'status': 'eq.pending'
});

const sentToday = await query('send_queue', {
  'status': 'eq.sent',
  'sent_at': `gte.${today}`
});

const failed = await query('send_queue', {
  'status': 'eq.failed'
});

console.log(`Overdue Messages: ${overdue.count}`);
console.log(`Pending Messages: ${pending.count}`);
console.log(`Sent Today: ${sentToday.count}`);
console.log(`Failed Messages: ${failed.count}\n`);

// 2. Reply Drafts Status
console.log('2. REPLY DRAFTS STATUS');
console.log('---------------------');

const pendingDrafts = await query('reply_drafts', {
  'status': 'eq.pending_approval'
});

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const expiredDrafts = await query('reply_drafts', {
  'status': 'eq.pending_approval',
  'created_at': `lt.${sevenDaysAgo}`
});

console.log(`Pending Approvals: ${pendingDrafts.count}`);
console.log(`Expired Drafts (>7 days): ${expiredDrafts.count}\n`);

// 3. Active Campaigns
console.log('3. ACTIVE CAMPAIGNS');
console.log('------------------');

const activeCampaigns = await query('campaigns', {
  'status': 'eq.active'
});

// Count campaigns without LinkedIn that are NOT email-only
const campaignsDetail = await query('campaigns', {
  'status': 'eq.active',
  'select': 'id,name,linkedin_account_id,campaign_type'
});

const noLinkedIn = campaignsDetail.data.filter(c =>
  !c.linkedin_account_id && c.campaign_type !== 'email_only'
).length;

console.log(`Active Campaigns: ${activeCampaigns.count}`);
console.log(`Without LinkedIn Account: ${noLinkedIn}\n`);

// 4. Unipile Accounts
console.log('4. UNIPILE ACCOUNTS');
console.log('------------------');

const accounts = await query('user_unipile_accounts', {
  'select': 'id,account_name,connection_status,platform'
});

const accountsByStatus = accounts.data.reduce((acc, account) => {
  acc[account.connection_status] = (acc[account.connection_status] || 0) + 1;
  return acc;
}, {});

const activeAccounts = accountsByStatus['active'] || 0;
const connectedAccounts = accountsByStatus['connected'] || 0;
const inactiveAccounts = accountsByStatus['inactive'] || 0;

console.log(`Total Accounts: ${accounts.count}`);
console.log(`Active: ${activeAccounts}`);
console.log(`Connected (should be active): ${connectedAccounts}`);
console.log(`Inactive: ${inactiveAccounts}\n`);

console.log('Account Details:');
if (accounts.data.length > 0) {
  accounts.data.forEach(account => {
    console.log(`  - ${account.account_name || 'Unnamed'} [${account.platform}]: ${account.connection_status}`);
  });
} else {
  console.log('  (No accounts found)');
}
console.log('');

// 5. Summary
console.log('==========================================');
console.log('HEALTH CHECK SUMMARY');
console.log('==========================================\n');

const queueStatus = overdue.count === 0 ? '✅' : '⚠️';
const draftsStatus = expiredDrafts.count === 0 ? '✅' : '⚠️';
const campaignsStatus = noLinkedIn === 0 ? '✅' : '⚠️';
const accountsStatus = (connectedAccounts === 0 && inactiveAccounts === 0) ? '✅' :
                       (connectedAccounts > 0 ? '⚠️' : '✅');

console.log('Component'.padEnd(30) + ' | ' + 'Status'.padEnd(10) + ' | Details');
console.log('-'.repeat(30) + ' | ' + '-'.repeat(10) + ' | ' + '-'.repeat(40));
console.log('Send Queue'.padEnd(30) + ' | ' + queueStatus.padEnd(10) + ' | ' +
  `${overdue.count} overdue, ${pending.count} pending, ${sentToday.count} sent today`);
console.log('Reply Drafts'.padEnd(30) + ' | ' + draftsStatus.padEnd(10) + ' | ' +
  `${pendingDrafts.count} pending, ${expiredDrafts.count} expired`);
console.log('Active Campaigns'.padEnd(30) + ' | ' + campaignsStatus.padEnd(10) + ' | ' +
  `${activeCampaigns.count} total, ${noLinkedIn} without LinkedIn`);
console.log('Unipile Accounts'.padEnd(30) + ' | ' + accountsStatus.padEnd(10) + ' | ' +
  `${activeAccounts} active, ${connectedAccounts} connected, ${inactiveAccounts} inactive`);
console.log('');
