import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 CHECKING VALID campaign_prospects STATUS VALUES\n');

// Get all distinct status values in use
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('status');

const statusCounts = {};
prospects?.forEach(p => {
  if (p.status) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }
});

console.log('Status values in use:\n');
Object.entries(statusCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([status, count]) => {
    console.log(`  ${status.padEnd(30)} (${count} records)`);
  });

console.log('\n');
