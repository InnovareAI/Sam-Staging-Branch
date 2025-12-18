import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function cleanup() {
  // Get all failed queue items with invalid_parameters error
  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, prospect_id, linkedin_user_id, error_message')
    .eq('status', 'failed')
    .ilike('error_message', '%invalid_parameters%');

  console.log(`Found ${failed?.length || 0} profile resolution failures`);

  if (!failed || failed.length === 0) {
    console.log('Nothing to clean up');
    return;
  }

  // Update prospects to 'failed' status with clear reason
  let updated = 0;
  for (const f of failed) {
    // Update queue error message to be human-readable
    await supabase
      .from('send_queue')
      .update({
        error_message: 'LinkedIn profile not found or inaccessible',
        updated_at: new Date().toISOString()
      })
      .eq('id', f.id);

    // Update prospect status
    const { error } = await supabase
      .from('campaign_prospects')
      .update({
        status: 'failed',
        notes: 'LinkedIn profile not found - may have changed URL or been deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', f.prospect_id);

    if (!error) updated++;
  }

  console.log(`✅ Updated ${updated} prospects to 'failed' status`);
}

cleanup().catch(console.error);
