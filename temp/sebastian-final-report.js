import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function generateReport() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   SEBASTIAN HENKEL - CAMPAIGN OVERVIEW REPORT');
  console.log('   Date: December 19, 2025');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Get both campaigns
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, campaign_type, created_at, connection_message, follow_up_messages')
    .eq('linkedin_account_id', '386feaac-21ca-45c9-b098-126bf49baa86')
    .order('created_at', { ascending: false });

  if (campaignsError) {
    console.error('Error fetching campaigns:', campaignsError);
    return;
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found');
    return;
  }

  for (const campaign of campaigns) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 CAMPAIGN: ' + campaign.name);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Basic Information:');
    console.log('  ID: ' + campaign.id);
    console.log('  Status: ' + campaign.status.toUpperCase());
    console.log('  Type: ' + (campaign.campaign_type || 'linkedin_only'));
    console.log('  Created: ' + new Date(campaign.created_at).toLocaleDateString());
    console.log('');

    // Get prospect counts
    const { data: prospects } = await supabase
      .from('campaign_prospects')
      .select('status')
      .eq('campaign_id', campaign.id);

    const statusCounts = (prospects || []).reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});

    console.log('Prospects Summary:');
    console.log('  Total: ' + (prospects?.length || 0));
    console.log('  Breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log('    - ' + status + ': ' + count);
    });
    console.log('');

    // Get send queue stats
    const { data: queueEntries } = await supabase
      .from('send_queue')
      .select('status, sent_at')
      .eq('campaign_id', campaign.id);

    const queueCounts = (queueEntries || []).reduce((acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    }, {});

    console.log('Send Queue Summary:');
    console.log('  Total Entries: ' + (queueEntries?.length || 0));
    if (queueEntries && queueEntries.length > 0) {
      console.log('  Status Breakdown:');
      Object.entries(queueCounts).forEach(([status, count]) => {
        console.log('    - ' + status + ': ' + count);
      });

      // Find last sent message
      const sentMessages = queueEntries.filter(e => e.status === 'sent' && e.sent_at);
      if (sentMessages.length > 0) {
        const lastSent = sentMessages.reduce((latest, msg) => {
          return new Date(msg.sent_at) > new Date(latest.sent_at) ? msg : latest;
        });
        console.log('  Last Message Sent: ' + new Date(lastSent.sent_at).toLocaleString());
      }
    } else {
      console.log('  No queue entries (campaign not yet executed)');
    }
    console.log('');

    // Message configuration
    console.log('Message Configuration:');
    console.log('  Connection Message: ' + (campaign.connection_message ? 'Configured' : 'NOT SET'));
    const followUpCount = campaign.follow_up_messages ? campaign.follow_up_messages.length : 0;
    console.log('  Follow-up Messages: ' + followUpCount + ' configured');
    console.log('');
  }

  // Messages sent today
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📨 MESSAGES SENT TODAY (December 19, 2025)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const todayStart = '2025-12-19T00:00:00Z';
  const { data: todayMessages } = await supabase
    .from('send_queue')
    .select('campaign_id')
    .in('campaign_id', campaigns.map(c => c.id))
    .gte('sent_at', todayStart);

  console.log('Total messages sent today: ' + (todayMessages?.length || 0));

  if (!todayMessages || todayMessages.length === 0) {
    console.log('');
    console.log('⚠️  No messages have been sent today.');
    console.log('');
    console.log('Note: The "Sebastian Henkel - Connect" campaign is PAUSED.');
    console.log('      The "ASP - Company Follow" campaign is ACTIVE but has not');
    console.log('      yet generated any queue entries.');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
}

generateReport().catch(console.error);
