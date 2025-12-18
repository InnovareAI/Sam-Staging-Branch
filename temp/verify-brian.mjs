import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const campaignId = '64c672da-fb0c-42f3-861e-a47fa29ac06b';

async function check() {
  // Get ALL prospects for this campaign
  const { data: allProspects } = await supabase
    .from('campaign_prospects')
    .select('id, status')
    .eq('campaign_id', campaignId);

  console.log('Total prospects:', allProspects?.length);

  // Get pending ones
  const pending = allProspects?.filter(p => p.status === 'pending' || p.status === 'approved') || [];
  console.log('Pending/approved:', pending.length);

  // Get queue entries
  const { data: queueEntries } = await supabase
    .from('send_queue')
    .select('prospect_id')
    .eq('campaign_id', campaignId);

  console.log('Queue entries:', queueEntries?.length);

  // Check overlap
  const pendingIds = new Set(pending.map(p => p.id));
  const queuedPendingIds = (queueEntries || []).filter(q => pendingIds.has(q.prospect_id));
  console.log('Queue entries matching pending prospects:', queuedPendingIds.length);

  // Unqueued
  const queuedIds = new Set((queueEntries || []).map(q => q.prospect_id));
  let unqueued = 0;
  for (const p of pending) {
    if (!queuedIds.has(p.id)) unqueued++;
  }
  console.log('Unqueued pending:', unqueued);
  console.log(unqueued === 0 ? '✅ ALL QUEUED' : '⚠️ ' + unqueued + ' missing');
}

check().catch(console.error);
