import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔍 VERIFICATION: Checking for remaining errors\n');

// Check for recent failures (last 30 minutes)
const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

const { data: recentFailed, error } = await supabase
  .from('send_queue')
  .select('id, linkedin_user_id, message_type, error_message, updated_at')
  .eq('status', 'failed')
  .gte('updated_at', thirtyMinAgo)
  .order('updated_at', { ascending: false });

if (error) {
  console.error('❌ Query error:', error);
} else {
  const count = recentFailed ? recentFailed.length : 0;
  console.log(`📊 Recent failures (last 30 min): ${count}\n`);

  if (count > 0) {
    console.log('Remaining errors:');
    recentFailed.forEach(item => {
      console.log(`\n  ID: ${item.id}`);
      console.log(`  LinkedIn ID: ${item.linkedin_user_id}`);
      console.log(`  Type: ${item.message_type}`);
      console.log(`  Error: ${item.error_message}`);
      console.log(`  Updated: ${item.updated_at}`);
    });
  } else {
    console.log('✅ No recent failures!');
  }
}

// Check pending count
const { count: pendingCount } = await supabase
  .from('send_queue')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'pending');

console.log(`\n📊 Pending messages: ${pendingCount}`);

// Check the fixed items
const fixedIds = [
  '5fc20455-b41f-4576-8592-67063329cbd4',  // digitalnoah
  'ac5ecdce-5c3c-4ab3-8292-4bd0ae76c3b7',  // zebanderson
  '73d84dec-ab72-4813-ada8-6128c3dda877',  // zach-epstein
  '78980587-e571-40c2-a2de-1953d63c6c05',  // mildred-ramos
  'b69b4337-65b4-43fb-82df-06e5210c0985',  // jerrybenton
  '9faf0a36-9927-41d9-9636-dbf896f50aa2'   // terry-katzur
];

const { data: fixedItems } = await supabase
  .from('send_queue')
  .select('id, linkedin_user_id, status, message_type')
  .in('id', fixedIds);

console.log('\n✅ FIXED ITEMS STATUS:');
console.log('======================');
if (fixedItems) {
  fixedItems.forEach(item => {
    const startsACo = item.linkedin_user_id.startsWith('ACo');
    const startsACw = item.linkedin_user_id.startsWith('ACw');
    const isResolved = startsACo || startsACw;
    console.log(`\n  ${item.linkedin_user_id}`);
    console.log(`    Status: ${item.status}`);
    console.log(`    Format: ${isResolved ? 'Provider ID ✅' : 'Vanity (NOT resolved)'}`);
  });
}
