import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking ONLY prospects that will be processed...\n');

// ONLY check statuses that will actually be sent
const { data: processable } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status')
  .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
  .in('status', ['pending', 'approved', 'ready_to_message'])
  .not('linkedin_url', 'is', null);

console.log('Prospects without names that WILL be processed:');
console.log('  Result:', processable?.length || 0);

if (processable && processable.length > 0) {
  console.log('\n  ERROR: These will cause blocking:');
  for (const p of processable) {
    console.log('    - ID:', p.id, 'Status:', p.status);
  }
  console.log('\n  RUN: node scripts/js/fix-missing-names.mjs');
  process.exit(1);
} else {
  console.log('  SUCCESS: All processable prospects have names\n');
}

// Show the historical ones that won't be processed
const { data: historical } = await supabase
  .from('campaign_prospects')
  .select('status')
  .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
  .in('status', ['connection_requested', 'already_invited', 'failed'])
  .not('linkedin_url', 'is', null);

if (historical && historical.length > 0) {
  console.log('Historical prospects without names (will NOT be processed):');
  const byStatus = new Map();
  for (const p of historical) {
    if (!byStatus.has(p.status)) byStatus.set(p.status, 0);
    byStatus.set(p.status, byStatus.get(p.status) + 1);
  }
  for (const [status, count] of byStatus.entries()) {
    console.log('  ', status + ':', count, '(already sent before fix)');
  }
  console.log('\n  These are historical and will not cause any errors.\n');
}

console.log('==============================================');
console.log('RESULT: READY FOR NEW MESSAGES');
console.log('==============================================');
