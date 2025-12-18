const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function cleanupDuplicates() {
  const campaignId = 'c243c82d-12fc-4b49-b5b2-c52a77708bf1';

  console.log('=== CLEANING UP DUPLICATE MESSAGES ===\n');

  // Get all linkedin_messages for this campaign
  const { data: messages } = await supabase
    .from('linkedin_messages')
    .select('id, prospect_id, sent_at, created_at')
    .eq('campaign_id', campaignId)
    .eq('direction', 'outgoing')
    .order('created_at', { ascending: true });

  // Group by prospect_id and keep only the FIRST message (delete the rest)
  const byProspect = {};
  messages.forEach(msg => {
    if (!byProspect[msg.prospect_id]) {
      byProspect[msg.prospect_id] = [];
    }
    byProspect[msg.prospect_id].push(msg);
  });

  let totalDeleted = 0;

  for (const [prospectId, msgs] of Object.entries(byProspect)) {
    if (msgs.length > 1) {
      // Keep the first message, delete the rest
      const toKeep = msgs[0];
      const toDelete = msgs.slice(1);

      console.log(`Prospect ${prospectId}: Keeping first message (${toKeep.id}), deleting ${toDelete.length} duplicates`);

      for (const msg of toDelete) {
        const { error } = await supabase
          .from('linkedin_messages')
          .delete()
          .eq('id', msg.id);

        if (error) {
          console.error(`  Failed to delete ${msg.id}:`, error.message);
        } else {
          console.log(`  Deleted message ${msg.id} (sent at ${msg.sent_at})`);
          totalDeleted++;
        }
      }
    }
  }

  console.log(`\n✅ Cleanup complete. Deleted ${totalDeleted} duplicate messages.`);
}

cleanupDuplicates();
