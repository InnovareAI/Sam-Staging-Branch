import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function getCampaignOverview() {
  console.log('=== SEBASTIAN HENKEL CAMPAIGN OVERVIEW ===');
  console.log('');

  // 1. Find Sebastian Henkel campaigns
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, linkedin_account_id, campaign_type, created_at')
    .ilike('name', '%sebastian%');

  if (campaignsError) {
    console.error('Error fetching campaigns:', campaignsError);
    return;
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found for Sebastian Henkel');
    return;
  }

  console.log('Found ' + campaigns.length + ' campaign(s):');
  console.log('');

  for (const campaign of campaigns) {
    console.log('📊 CAMPAIGN: ' + campaign.name);
    console.log('   ID: ' + campaign.id);
    console.log('   Status: ' + campaign.status);
    console.log('   Type: ' + (campaign.campaign_type || 'linkedin_only'));
    console.log('   LinkedIn Account: ' + campaign.linkedin_account_id);
    console.log('   Created: ' + new Date(campaign.created_at).toLocaleDateString());

    // Get prospect counts by status
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('status')
      .eq('campaign_id', campaign.id);

    if (!prospectsError && prospects) {
      const statusCounts = prospects.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});

      console.log('   Total Prospects: ' + prospects.length);
      console.log('   Breakdown by Status:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log('     - ' + status + ': ' + count);
      });
    }
    console.log('');
  }

  // 2. Get messages sent today
  console.log('');
  console.log('📨 MESSAGES SENT TODAY (Dec 19, 2025):');
  console.log('');

  const todayStart = '2025-12-19T00:00:00Z';
  const { data: messages, error: messagesError } = await supabase
    .from('send_queue')
    .select('id, campaign_id, prospect_id, linkedin_user_id, sent_at, status, error_message')
    .gte('sent_at', todayStart)
    .in('campaign_id', campaigns.map(c => c.id))
    .order('sent_at', { ascending: false });

  if (messagesError) {
    console.error('Error fetching messages:', messagesError);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log('No messages sent today');
  } else {
    console.log('Total messages sent today: ' + messages.length);
    console.log('');

    const messagesByCampaign = messages.reduce((acc, msg) => {
      const campaign = campaigns.find(c => c.id === msg.campaign_id);
      const campaignName = campaign ? campaign.name : 'Unknown';
      if (!acc[campaignName]) acc[campaignName] = [];
      acc[campaignName].push(msg);
      return acc;
    }, {});

    Object.entries(messagesByCampaign).forEach(([campaignName, msgs]) => {
      console.log('Campaign: ' + campaignName);
      console.log('Messages: ' + msgs.length);
      console.log('');

      msgs.forEach((msg, idx) => {
        console.log('  ' + (idx + 1) + '. Prospect ID: ' + msg.prospect_id);
        console.log('     LinkedIn ID: ' + msg.linkedin_user_id);
        console.log('     Sent: ' + new Date(msg.sent_at).toLocaleString());
        console.log('     Status: ' + msg.status);
        if (msg.error_message) {
          console.log('     Error: ' + msg.error_message);
        }
        console.log('');
      });
    });
  }

  // 3. Check for failed/pending messages
  console.log('');
  console.log('⚠️  FAILED OR PENDING MESSAGES:');
  console.log('');

  const { data: failedMessages, error: failedError } = await supabase
    .from('send_queue')
    .select('id, campaign_id, prospect_id, status, error_message, scheduled_send_time')
    .in('campaign_id', campaigns.map(c => c.id))
    .in('status', ['failed', 'pending', 'queued']);

  if (!failedError && failedMessages && failedMessages.length > 0) {
    console.log('Found ' + failedMessages.length + ' failed/pending message(s):');
    console.log('');

    failedMessages.forEach((msg, idx) => {
      const campaign = campaigns.find(c => c.id === msg.campaign_id);
      console.log((idx + 1) + '. Prospect ID: ' + msg.prospect_id);
      console.log('   Campaign: ' + (campaign?.name || 'Unknown'));
      console.log('   Status: ' + msg.status);
      console.log('   Scheduled: ' + (msg.scheduled_send_time ? new Date(msg.scheduled_send_time).toLocaleString() : 'N/A'));
      if (msg.error_message) {
        console.log('   Error: ' + msg.error_message);
      }
      console.log('');
    });
  } else {
    console.log('No failed or pending messages');
  }
}

getCampaignOverview().catch(console.error);
