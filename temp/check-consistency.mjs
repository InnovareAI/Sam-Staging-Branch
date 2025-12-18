import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Find queue items marked 'sent' where prospect status is not updated
  const { data: sentQueue } = await supabase
    .from('send_queue')
    .select('id, prospect_id, campaign_id, status, sent_at')
    .eq('status', 'sent');

  console.log('Total sent queue items:', sentQueue?.length);

  const mismatches = [];
  for (const q of sentQueue || []) {
    const { data: prospect } = await supabase
      .from('campaign_prospects')
      .select('id, status, first_name, last_name')
      .eq('id', q.prospect_id)
      .single();

    if (prospect && prospect.status !== 'connection_request_sent') {
      mismatches.push({
        name: `${prospect.first_name} ${prospect.last_name}`,
        prospectStatus: prospect.status,
        queueStatus: 'sent',
        sentAt: q.sent_at,
        prospectId: q.prospect_id
      });
    }
  }

  console.log('\nMismatches found:', mismatches.length);
  mismatches.forEach(m => {
    console.log(`  ${m.name}: queue=sent, prospect=${m.prospectStatus}`);
  });

  // Fix only the ones with 'approved' or 'pending' status (actually out of sync)
  // Don't "fix" replied/connected/failed - those are MORE advanced than connection_request_sent
  const needsFix = mismatches.filter(m =>
    m.prospectStatus === 'approved' || m.prospectStatus === 'pending'
  );

  console.log('\nNeed fixing (approved/pending -> connection_request_sent):', needsFix.length);

  if (needsFix.length > 0) {
    console.log('Fixing...');
    for (const m of needsFix) {
      const { error } = await supabase
        .from('campaign_prospects')
        .update({
          status: 'connection_request_sent',
          contacted_at: m.sentAt || new Date().toISOString()
        })
        .eq('id', m.prospectId);

      if (error) {
        console.log(`  ❌ Failed to fix ${m.name}:`, error.message);
      } else {
        console.log(`  ✅ Fixed ${m.name}`);
      }
    }
  }
}

check().catch(console.error);
