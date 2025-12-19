import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function getAllSebastianCampaigns() {
  console.log('=== SEBASTIAN HENKEL - ALL CAMPAIGNS ===');
  console.log('');

  // First, find Sebastian's LinkedIn account
  const { data: linkedinAccount, error: accountError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('id', '386feaac-21ca-45c9-b098-126bf49baa86')
    .single();

  if (accountError) {
    console.error('Error fetching LinkedIn account:', accountError);
    return;
  }

  console.log('LinkedIn Account Details:');
  console.log('  Name: ' + linkedinAccount.display_name);
  console.log('  ID: ' + linkedinAccount.id);
  console.log('  Workspace ID: ' + linkedinAccount.workspace_id);
  console.log('');

  // Find all campaigns for this LinkedIn account
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, linkedin_account_id, campaign_type, created_at')
    .eq('linkedin_account_id', linkedinAccount.id)
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.error('Error fetching campaigns:', campaignsError);
    return;
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found for this LinkedIn account');
    return;
  }

  console.log('Found ' + campaigns.length + ' campaign(s):');
  console.log('');

  for (const campaign of campaigns) {
    console.log('📊 CAMPAIGN: ' + campaign.name);
    console.log('   ID: ' + campaign.id);
    console.log('   Status: ' + campaign.status);
    console.log('   Type: ' + (campaign.campaign_type || 'linkedin_only'));
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

  // Get messages sent today for all campaigns
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
  } else if (!messages || messages.length === 0) {
    console.log('No messages sent today');
  } else {
    console.log('Total messages sent today: ' + messages.length);
    console.log('');

    // Get prospect details for each message
    const prospectIds = [...new Set(messages.map(m => m.prospect_id))];
    const { data: prospectDetails } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, full_name')
      .in('id', prospectIds);

    const prospectMap = (prospectDetails || []).reduce((acc, p) => {
      acc[p.id] = p.full_name || (p.first_name + ' ' + p.last_name);
      return acc;
    }, {});

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
        const prospectName = prospectMap[msg.prospect_id] || 'Unknown';
        console.log('  ' + (idx + 1) + '. ' + prospectName);
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

  // Check for failed/pending messages
  console.log('');
  console.log('⚠️  FAILED OR PENDING MESSAGES:');
  console.log('');

  const { data: failedMessages, error: failedError } = await supabase
    .from('send_queue')
    .select('id, campaign_id, prospect_id, status, error_message, scheduled_send_time')
    .in('campaign_id', campaigns.map(c => c.id))
    .in('status', ['failed', 'pending', 'queued']);

  if (!failedError && failedMessages && failedMessages.length > 0) {
    // Get prospect details
    const prospectIds = [...new Set(failedMessages.map(m => m.prospect_id))];
    const { data: prospectDetails } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, full_name')
      .in('id', prospectIds);

    const prospectMap = (prospectDetails || []).reduce((acc, p) => {
      acc[p.id] = p.full_name || (p.first_name + ' ' + p.last_name);
      return acc;
    }, {});

    console.log('Found ' + failedMessages.length + ' failed/pending message(s):');
    console.log('');

    failedMessages.forEach((msg, idx) => {
      const campaign = campaigns.find(c => c.id === msg.campaign_id);
      const prospectName = prospectMap[msg.prospect_id] || 'Unknown';
      console.log((idx + 1) + '. ' + prospectName);
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

getAllSebastianCampaigns().catch(console.error);
