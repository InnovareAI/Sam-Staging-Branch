import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function recoverProspects() {
  // Find prospects marked as failed that have valid ACo/ACw provider_ids
  const { data: recoverable } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, linkedin_user_id')
    .eq('status', 'failed')
    .or('linkedin_user_id.like.ACo%,linkedin_user_id.like.ACw%');

  console.log('Found', recoverable?.length || 0, 'recoverable prospects');

  if (!recoverable || recoverable.length === 0) {
    console.log('Nothing to recover');
    return;
  }

  // Reset prospects to approved
  const prospectIds = recoverable.map(p => p.id);
  const { error: updateError } = await supabase
    .from('campaign_prospects')
    .update({ status: 'approved' })
    .in('id', prospectIds);

  if (updateError) {
    console.error('Error updating prospects:', updateError.message);
  } else {
    console.log('✅ Reset', prospectIds.length, 'prospects to approved');
  }
}

recoverProspects();
