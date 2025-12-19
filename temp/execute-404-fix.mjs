import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔧 Fixing 404 Endpoint Errors\n');

const ids = [
  '5fc20455-b41f-4576-8592-67063329cbd4',  // digitalnoah
  'ac5ecdce-5c3c-4ab3-8292-4bd0ae76c3b7'   // zebanderson
];

// Update to pending
const { data: updated, error } = await supabase
  .from('send_queue')
  .update({
    status: 'pending',
    error_message: null,
    scheduled_for: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .in('id', ids)
  .eq('status', 'failed')
  .select();

if (error) {
  console.error('❌ Update error:', error);
} else {
  const count = updated ? updated.length : 0;
  console.log(`✅ Updated ${count} items\n`);
}

// Verify
const { data: items } = await supabase
  .from('send_queue')
  .select('id, linkedin_user_id, message_type, status, error_message, scheduled_for')
  .in('id', ids);

console.log('Verification:');
if (items) {
  items.forEach(item => {
    console.log(`\nID: ${item.id}`);
    console.log(`  LinkedIn ID: ${item.linkedin_user_id}`);
    console.log(`  Type: ${item.message_type}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Error: ${item.error_message || 'none'}`);
    console.log(`  Scheduled: ${item.scheduled_for}`);
  });
}
