import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function checkLimits() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // Get all LinkedIn accounts
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('id, account_name, unipile_account_id, workspace_id, workspaces(name)')
    .eq('account_type', 'linkedin')
    .eq('is_active', true);

  console.log('='.repeat(70));
  console.log('DAILY SEND LIMITS CHECK - ' + new Date().toISOString().split('T')[0]);
  console.log('='.repeat(70));
  console.log('\nDaily CR Limit: 20 per account');
  console.log('Weekly CR Limit: 100 per account');
  console.log('');

  for (const account of accounts || []) {
    // Get campaigns using this account
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, campaign_name, name')
      .eq('linkedin_account_id', account.unipile_account_id);

    if (!campaigns || campaigns.length === 0) continue;

    const campaignIds = campaigns.map(c => c.id);

    // Count sent today for this account's campaigns
    const { data: sentToday } = await supabase
      .from('send_queue')
      .select('id')
      .in('campaign_id', campaignIds)
      .eq('status', 'sent')
      .gte('sent_at', todayStr);

    // Count pending for this account
    const { data: pending } = await supabase
      .from('send_queue')
      .select('id')
      .in('campaign_id', campaignIds)
      .eq('status', 'pending');

    // Count sent this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: sentWeek } = await supabase
      .from('send_queue')
      .select('id')
      .in('campaign_id', campaignIds)
      .eq('status', 'sent')
      .gte('sent_at', weekAgo.toISOString());

    const sentTodayCount = sentToday?.length || 0;
    const pendingCount = pending?.length || 0;
    const sentWeekCount = sentWeek?.length || 0;

    const dailyRemaining = Math.max(0, 20 - sentTodayCount);
    const weeklyRemaining = Math.max(0, 100 - sentWeekCount);

    const atDailyLimit = sentTodayCount >= 20;
    const atWeeklyLimit = sentWeekCount >= 100;

    console.log(account.account_name + ' (' + (account.workspaces?.name || 'Unknown') + ')');
    console.log('  Today: ' + sentTodayCount + '/20 sent (' + dailyRemaining + ' remaining) ' + (atDailyLimit ? '⚠️ AT LIMIT' : '✅'));
    console.log('  Week:  ' + sentWeekCount + '/100 sent (' + weeklyRemaining + ' remaining) ' + (atWeeklyLimit ? '🛑 AT LIMIT' : '✅'));
    console.log('  Pending: ' + pendingCount + ' in queue');
    console.log('  Campaigns: ' + campaigns.map(c => c.campaign_name || c.name).slice(0, 3).join(', ') + (campaigns.length > 3 ? '...' : ''));
    console.log('');
  }
}

checkLimits().catch(console.error);
