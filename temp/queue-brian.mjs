import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function queue() {
  const campId = '64c672da-fb0c-42f3-861e-a47fa29ac06b';
  const brianWsId = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';
  const linkedinAccountId = '2162a64f-a45a-4de5-8b5e-0ea581a949f2';

  // Get campaign message
  const { data: camp } = await supabase
    .from('campaigns')
    .select('connection_message')
    .eq('id', campId)
    .single();

  const message = camp?.connection_message;
  console.log('Message:', message ? message.substring(0, 50) + '...' : 'NONE');

  if (!message) {
    console.log('ERROR: No message set');
    return;
  }

  // Get pending prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, linkedin_url')
    .eq('campaign_id', campId)
    .eq('status', 'pending')
    .not('linkedin_url', 'is', null);

  console.log('Pending prospects:', prospects?.length || 0);

  if (!prospects || prospects.length === 0) {
    console.log('No prospects to queue');
    return;
  }

  // Check existing queue to avoid duplicates
  const { data: existing } = await supabase
    .from('send_queue')
    .select('prospect_id')
    .eq('campaign_id', campId);

  const existingIds = new Set(existing?.map(e => e.prospect_id) || []);
  console.log('Already in queue:', existingIds.size);

  // Filter out duplicates
  const toQueue = prospects.filter(p => !existingIds.has(p.id));
  console.log('To queue:', toQueue.length);

  if (toQueue.length === 0) {
    console.log('All already queued');
    return;
  }

  // Create queue items in batches
  const BATCH_SIZE = 100;
  let queued = 0;
  const now = new Date();

  for (let i = 0; i < toQueue.length; i += BATCH_SIZE) {
    const batch = toQueue.slice(i, i + BATCH_SIZE);

    const items = batch.map((p, idx) => {
      // Personalize message
      const personalizedMsg = message.replace(/\{\{firstName\}\}/gi, p.first_name || 'there');

      // Schedule with spacing (20 min between each)
      const scheduledFor = new Date(now.getTime() + (i + idx) * 20 * 60 * 1000);

      return {
        campaign_id: campId,
        prospect_id: p.id,
        linkedin_user_id: p.linkedin_url, // Will be resolved at send time
        message: personalizedMsg,
        message_type: 'connection_request',
        status: 'pending',
        scheduled_for: scheduledFor.toISOString(),
        created_at: now.toISOString()
      };
    });

    const { error } = await supabase
      .from('send_queue')
      .insert(items);

    if (error) {
      console.log('Error at batch', i, ':', error.message);
    } else {
      queued += batch.length;
      console.log('Queued batch', Math.floor(i / BATCH_SIZE) + 1, '-', queued, 'total');
    }
  }

  console.log('\nDone! Queued', queued, 'prospects');

  // Update prospect status
  const prospectIds = toQueue.map(p => p.id);
  await supabase
    .from('campaign_prospects')
    .update({ status: 'queued' })
    .in('id', prospectIds);

  console.log('Updated prospect statuses to queued');
}

queue().catch(console.error);
