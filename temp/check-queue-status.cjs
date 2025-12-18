const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function checkQueueStatus() {
  const campaignId = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1';

  // The prospect IDs with duplicates
  const duplicateProspects = [
    '17c599aa-0c8c-4a02-b0e9-40d9f231f051', // Ivonne - 3 messages
    '7e9ce59b-feb7-4a50-a787-3300342d21a6', // Carl - 2 messages
    '5f67ba9a-b6d7-497b-8c08-5804486d997e', // Chudi - 3 messages
    '246874e7-3524-4eb7-b556-04ac43a8f798'  // Gilad - 2 messages
  ];

  console.log('=== CHECKING SEND_QUEUE FOR DUPLICATE VICTIMS ===\n');

  for (const prospectId of duplicateProspects) {
    const { data: queueEntries } = await supabase
      .from('send_queue')
      .select(`
        id,
        status,
        sent_at,
        created_at,
        campaign_prospects!inner(first_name, last_name)
      `)
      .eq('campaign_id', campaignId)
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: true });

    if (queueEntries && queueEntries.length > 0) {
      const prospect = queueEntries[0].campaign_prospects;
      console.log(`${prospect.first_name} ${prospect.last_name} (${prospectId}):`);
      console.log(`  Queue entries: ${queueEntries.length}`);
      queueEntries.forEach(e => {
        console.log(`    - ID: ${e.id} | Status: ${e.status} | Sent: ${e.sent_at} | Created: ${e.created_at}`);
      });
      console.log('');
    }
  }

  // Check if there are multiple queue entries with status='sent' for same prospect
  console.log('=== CHECKING FOR MULTIPLE "SENT" QUEUE ENTRIES ===\n');

  const { data: allSent } = await supabase
    .from('send_queue')
    .select('prospect_id, status, sent_at, id')
    .eq('campaign_id', campaignId)
    .eq('status', 'sent')
    .order('prospect_id', { ascending: true });

  const byProspect = {};
  allSent.forEach(e => {
    if (!byProspect[e.prospect_id]) {
      byProspect[e.prospect_id] = [];
    }
    byProspect[e.prospect_id].push(e);
  });

  Object.entries(byProspect).forEach(([prospectId, entries]) => {
    if (entries.length > 1) {
      console.log(`Prospect ${prospectId}: ${entries.length} queue entries marked as "sent"`);
      entries.forEach(e => {
        console.log(`  - Queue ID: ${e.id} | Sent: ${e.sent_at}`);
      });
      console.log('');
    }
  });
}

checkQueueStatus();
