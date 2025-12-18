const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function resetStuckProcessing() {
  console.log('=== CHECKING FOR STUCK PROCESSING ITEMS ===\n');

  // Find any items stuck in 'processing' status for more than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: stuckItems } = await supabase
    .from('send_queue')
    .select('id, campaign_id, prospect_id, status, updated_at')
    .eq('status', 'processing')
    .lt('updated_at', fiveMinutesAgo);

  console.log(`Found ${stuckItems?.length || 0} items stuck in 'processing' status`);

  if (stuckItems && stuckItems.length > 0) {
    console.log('\nResetting stuck items to pending...\n');

    for (const item of stuckItems) {
      const { error } = await supabase
        .from('send_queue')
        .update({
          status: 'pending',
          error_message: 'Reset from stuck processing state',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) {
        console.error(`  Failed to reset ${item.id}:`, error.message);
      } else {
        console.log(`  Reset ${item.id} (updated ${item.updated_at})`);
      }
    }

    console.log(`\n✅ Reset ${stuckItems.length} stuck items to pending`);
  } else {
    console.log('✅ No stuck items found');
  }
}

resetStuckProcessing();
