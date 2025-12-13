import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function checkLimits() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  console.log('='.repeat(70));
  console.log('DAILY SEND LIMITS CHECK - ' + new Date().toISOString().split('T')[0]);
  console.log('='.repeat(70));
  console.log('\nDaily CR Limit: 20 per account');
  console.log('Weekly CR Limit: 100 per account\n');

  // Get campaigns with their linkedin_account_id
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, campaign_name, name, linkedin_account_id, status')
    .in('status', ['active', 'running', 'paused'])
    .not('linkedin_account_id', 'is', null);

  // Group campaigns by linkedin_account_id
  const byAccount = {};
  for (const c of campaigns || []) {
    const accId = c.linkedin_account_id;
    if (!byAccount[accId]) {
      byAccount[accId] = [];
    }
    byAccount[accId].push(c);
  }

  // Get account names from user_unipile_accounts
  const { data: unipileAccounts } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id, account_name');

  const accountNames = {};
  for (const a of unipileAccounts || []) {
    accountNames[a.unipile_account_id] = a.account_name;
  }

  // For each account, calculate limits
  for (const [accountId, accountCampaigns] of Object.entries(byAccount)) {
    const accountName = accountNames[accountId] || accountId.substring(0, 12);
    const campaignIds = accountCampaigns.map(c => c.id);

    // Count sent today
    const { count: sentTodayCount } = await supabase
      .from('send_queue')
      .select('id', { count: 'exact', head: true })
      .in('campaign_id', campaignIds)
      .eq('status', 'sent')
      .gte('sent_at', todayStr);

    // Count pending
    const { count: pendingCount } = await supabase
      .from('send_queue')
      .select('id', { count: 'exact', head: true })
      .in('campaign_id', campaignIds)
      .eq('status', 'pending');

    // Count sent this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: sentWeekCount } = await supabase
      .from('send_queue')
      .select('id', { count: 'exact', head: true })
      .in('campaign_id', campaignIds)
      .eq('status', 'sent')
      .gte('sent_at', weekAgo.toISOString());

    const dailyRemaining = Math.max(0, 20 - (sentTodayCount || 0));
    const weeklyRemaining = Math.max(0, 100 - (sentWeekCount || 0));

    const atDailyLimit = (sentTodayCount || 0) >= 20;
    const atWeeklyLimit = (sentWeekCount || 0) >= 100;

    console.log(accountName);
    console.log('  Today: ' + (sentTodayCount || 0) + '/20 sent (' + dailyRemaining + ' remaining) ' + (atDailyLimit ? '⚠️ AT LIMIT' : '✅'));
    console.log('  Week:  ' + (sentWeekCount || 0) + '/100 sent (' + weeklyRemaining + ' remaining) ' + (atWeeklyLimit ? '🛑 AT LIMIT' : '✅'));
    console.log('  Pending: ' + (pendingCount || 0) + ' in queue');
    console.log('  Campaigns: ' + accountCampaigns.map(c => c.campaign_name || c.name).slice(0, 2).join(', ') + (accountCampaigns.length > 2 ? ' (+' + (accountCampaigns.length - 2) + ' more)' : ''));
    console.log('');
  }
}

checkLimits().catch(console.error);
