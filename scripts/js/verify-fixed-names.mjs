import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Verifying fixed names and prospect statuses...\n');

// Check for any remaining missing names
const { data: stillMissing } = await supabase
  .from('campaign_prospects')
  .select('id, campaign_id, first_name, last_name, status')
  .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
  .not('linkedin_url', 'is', null);

console.log(`Prospects still missing names: ${stillMissing?.length || 0}\n`);

if (stillMissing && stillMissing.length > 0) {
  console.log('⚠️  Still missing names:');
  for (const p of stillMissing) {
    console.log(`  - ${p.id}: "${p.first_name}" "${p.last_name}" (${p.status})`);
  }
  console.log('');
}

// Check status distribution for all prospects
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Prospect status distribution:\n');

const { data: allProspects } = await supabase
  .from('campaign_prospects')
  .select('status');

const statusCount = new Map();
for (const p of allProspects || []) {
  const count = statusCount.get(p.status) || 0;
  statusCount.set(p.status, count + 1);
}

for (const [status, count] of statusCount.entries()) {
  console.log(`  ${status}: ${count}`);
}

// Check the 81 prospects we just fixed
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Recently updated prospects (last 90):\n');

const { data: recentlyUpdated } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status, contacted_at, updated_at')
  .order('updated_at', { ascending: false })
  .limit(90);

const recentStatusCount = new Map();
for (const p of recentlyUpdated || []) {
  const count = recentStatusCount.get(p.status) || 0;
  recentStatusCount.set(p.status, count + 1);
}

console.log('Status breakdown of recently updated:');
for (const [status, count] of recentStatusCount.entries()) {
  console.log(`  ${status}: ${count}`);
}

// Sample 10 recently updated prospects
console.log('\nSample of recently updated prospects:');
for (let i = 0; i < Math.min(10, recentlyUpdated?.length || 0); i++) {
  const p = recentlyUpdated[i];
  console.log(`  ${p.first_name} ${p.last_name} - ${p.status}`);
  if (p.contacted_at) {
    console.log(`    Contacted: ${p.contacted_at}`);
  }
}

console.log('\n✅ Verification complete');
