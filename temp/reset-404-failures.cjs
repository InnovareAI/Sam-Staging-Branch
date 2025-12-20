require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('Resetting queue items with /messages/send 404 error...\n');

  // First, check how many items are affected
  const { data: failedItems, error: fetchError } = await supabase
    .from('send_queue')
    .select('id, campaign_id, message_type, error_message, updated_at')
    .eq('status', 'failed')
    .ilike('error_message', '%Cannot POST /api/v1/messages/send%');

  if (fetchError) {
    console.log('Error fetching items:', fetchError.message);
    return;
  }

  console.log(`Found ${failedItems?.length || 0} items to reset\n`);

  if (!failedItems || failedItems.length === 0) {
    console.log('No items need resetting.');
    return;
  }

  // Show what we're about to reset
  for (const item of failedItems) {
    console.log(`ID: ${item.id}`);
    console.log(`  Type: ${item.message_type}`);
    console.log(`  Failed at: ${item.updated_at}`);
    console.log('---');
  }

  // Reset them to pending
  const ids = failedItems.map(i => i.id);

  const { data: updated, error: updateError } = await supabase
    .from('send_queue')
    .update({
      status: 'pending',
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .in('id', ids)
    .select('id');

  if (updateError) {
    console.log('\nError resetting items:', updateError.message);
    return;
  }

  console.log(`\n✅ Reset ${updated?.length || 0} items to pending status`);
  console.log('They will be retried by the next cron job execution.');
})();
