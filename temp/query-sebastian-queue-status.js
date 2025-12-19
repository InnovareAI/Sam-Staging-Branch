import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const campaignIds = [
  '20881373-b058-47dc-855b-d458503db5bc', // ASP - Company Follow
  'd7ced167-e7e7-42f2-ba12-dc3bb2d29cfc'  // Sebastian Henkel - Connect
];

async function getQueueStatus() {
  console.log('=== SEND QUEUE STATUS FOR SEBASTIAN\'S CAMPAIGNS ===');
  console.log('');

  // Get all queue entries for these campaigns
  const { data: queueEntries, error: queueError } = await supabase
    .from('send_queue')
    .select('*')
    .in('campaign_id', campaignIds)
    .order('created_at', { ascending: false })
    .limit(100);

  if (queueError) {
    console.error('Error fetching queue entries:', queueError);
    return;
  }

  console.log('Total queue entries: ' + (queueEntries?.length || 0));
  console.log('');

  if (queueEntries && queueEntries.length > 0) {
    // Group by campaign and status
    const byCampaign = queueEntries.reduce((acc, entry) => {
      const campaignId = entry.campaign_id;
      if (!acc[campaignId]) {
        acc[campaignId] = {
          name: campaignId === '20881373-b058-47dc-855b-d458503db5bc' ? 'ASP - Company Follow' : 'Sebastian Henkel - Connect',
          entries: []
        };
      }
      acc[campaignId].entries.push(entry);
      return acc;
    }, {});

    Object.entries(byCampaign).forEach(([campaignId, data]) => {
      console.log('📊 ' + data.name);
      console.log('   Campaign ID: ' + campaignId);
      console.log('   Total Queue Entries: ' + data.entries.length);

      const statusCounts = data.entries.reduce((acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1;
        return acc;
      }, {});

      console.log('   Status Breakdown:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log('     - ' + status + ': ' + count);
      });

      // Show recent entries
      console.log('');
      console.log('   Recent Entries (last 10):');
      const recent = data.entries.slice(0, 10);
      recent.forEach((entry, idx) => {
        console.log('   ' + (idx + 1) + '. Status: ' + entry.status);
        console.log('      Created: ' + new Date(entry.created_at).toLocaleString());
        if (entry.scheduled_send_time) {
          console.log('      Scheduled: ' + new Date(entry.scheduled_send_time).toLocaleString());
        }
        if (entry.sent_at) {
          console.log('      Sent: ' + new Date(entry.sent_at).toLocaleString());
        }
        if (entry.error_message) {
          console.log('      Error: ' + entry.error_message);
        }
        console.log('');
      });
    });
  } else {
    console.log('No queue entries found');
  }

  // Check messages sent in the last 7 days
  console.log('');
  console.log('📅 MESSAGES SENT IN LAST 7 DAYS:');
  console.log('');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  const { data: recentMessages, error: recentError } = await supabase
    .from('send_queue')
    .select('id, campaign_id, prospect_id, sent_at, status')
    .in('campaign_id', campaignIds)
    .gte('sent_at', sevenDaysAgoISO)
    .order('sent_at', { ascending: false });

  if (recentError) {
    console.error('Error fetching recent messages:', recentError);
  } else if (!recentMessages || recentMessages.length === 0) {
    console.log('No messages sent in the last 7 days');
  } else {
    // Get prospect details
    const prospectIds = [...new Set(recentMessages.map(m => m.prospect_id))];
    const { data: prospectDetails } = await supabase
      .from('campaign_prospects')
      .select('id, first_name, last_name, full_name')
      .in('id', prospectIds);

    const prospectMap = (prospectDetails || []).reduce((acc, p) => {
      acc[p.id] = p.full_name || (p.first_name + ' ' + p.last_name);
      return acc;
    }, {});

    console.log('Total messages sent: ' + recentMessages.length);
    console.log('');

    const messagesByCampaign = recentMessages.reduce((acc, msg) => {
      const campaignId = msg.campaign_id;
      const campaignName = campaignId === '20881373-b058-47dc-855b-d458503db5bc' ? 'ASP - Company Follow' : 'Sebastian Henkel - Connect';
      if (!acc[campaignName]) acc[campaignName] = [];
      acc[campaignName].push(msg);
      return acc;
    }, {});

    Object.entries(messagesByCampaign).forEach(([campaignName, msgs]) => {
      console.log('Campaign: ' + campaignName);
      console.log('Messages sent: ' + msgs.length);
      console.log('');

      msgs.slice(0, 20).forEach((msg, idx) => {
        const prospectName = prospectMap[msg.prospect_id] || 'Unknown';
        console.log('  ' + (idx + 1) + '. ' + prospectName);
        console.log('     Sent: ' + new Date(msg.sent_at).toLocaleString());
        console.log('     Status: ' + msg.status);
        console.log('');
      });

      if (msgs.length > 20) {
        console.log('  ... and ' + (msgs.length - 20) + ' more');
        console.log('');
      }
    });
  }
}

getQueueStatus().catch(console.error);
