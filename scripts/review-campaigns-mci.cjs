const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const workspaces = {
  'Michelle (IA2)': '04666209-fce8-4d71-8eaf-01278edfc73b',
  'Irish (IA3)': '96c03b38-a2f4-40de-9e16-43098599e1d4',
  'Charissa (IA4)': '7f0341da-88db-476b-ae0a-fc0da5b70861'
};

(async () => {
  for (const [owner, wsId] of Object.entries(workspaces)) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 ' + owner);
    console.log('   Workspace ID: ' + wsId);
    console.log('='.repeat(60));

    // Get campaigns
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id, name, status, campaign_type, created_at, updated_at')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('❌ Error:', error.message);
      continue;
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('\n  No campaigns found');
      continue;
    }

    console.log('\n  Total Campaigns: ' + campaigns.length);

    for (const c of campaigns) {
      // Get prospect counts per campaign
      const { count: totalProspects } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id);

      const { count: sentCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .eq('status', 'connection_request_sent');

      const { count: acceptedCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .eq('status', 'connected');

      const { count: pendingCount } = await supabase
        .from('campaign_prospects')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', c.id)
        .in('status', ['pending', 'approved', 'queued']);

      const created = new Date(c.created_at).toLocaleDateString();
      const statusEmoji = c.status === 'active' ? '🟢' : c.status === 'paused' ? '🟡' : c.status === 'completed' ? '✅' : '⚪';

      console.log('\n  ' + statusEmoji + ' ' + c.name);
      console.log('     Status: ' + c.status);
      console.log('     Type: ' + (c.campaign_type || 'linkedin'));
      console.log('     Prospects: ' + (totalProspects || 0) + ' total');
      console.log('       - CR Sent: ' + (sentCount || 0));
      console.log('       - Connected: ' + (acceptedCount || 0));
      console.log('       - Pending: ' + (pendingCount || 0));
      console.log('     Created: ' + created);
      console.log('     ID: ' + c.id);
    }
  }

  // Also check send_queue status
  console.log('\n\n' + '='.repeat(60));
  console.log('📬 SEND QUEUE STATUS');
  console.log('='.repeat(60));

  const { data: queueStats } = await supabase
    .from('send_queue')
    .select('status, campaign_id')
    .in('status', ['pending', 'processing', 'sent', 'failed']);

  if (queueStats && queueStats.length > 0) {
    const byStatus = {};
    queueStats.forEach(q => {
      byStatus[q.status] = (byStatus[q.status] || 0) + 1;
    });
    console.log('\n  Queue items by status:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log('    - ' + status + ': ' + count);
    });
  } else {
    console.log('\n  No items in queue');
  }

  // Check for upcoming scheduled items
  const { data: upcoming } = await supabase
    .from('send_queue')
    .select('id, scheduled_for, status')
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(5);

  if (upcoming && upcoming.length > 0) {
    console.log('\n  Next 5 scheduled:');
    upcoming.forEach(q => {
      const scheduled = new Date(q.scheduled_for).toLocaleString();
      console.log('    - ' + scheduled);
    });
  }
})();
