import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('📊 Checking all campaign statuses...\n');

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, workspace_id, status, created_at, workspaces(name)')
  .order('created_at', { ascending: false });

console.log(`Total campaigns: ${campaigns?.length || 0}\n`);

// Group by status
const byStatus = new Map();
for (const c of campaigns || []) {
  if (!byStatus.has(c.status)) {
    byStatus.set(c.status, []);
  }
  byStatus.get(c.status).push(c);
}

for (const [status, camps] of byStatus.entries()) {
  console.log(`\n${status.toUpperCase()}: ${camps.length}`);
  for (const c of camps) {
    console.log(`  ${c.workspaces.name}: ${c.name}`);

    // Check if has pending prospects
    const { data: pending } = await supabase
      .from('campaign_prospects')
      .select('id')
      .eq('campaign_id', c.id)
      .in('status', ['pending', 'approved', 'ready_to_message'])
      .limit(1);

    if (pending && pending.length > 0) {
      console.log(`    ⚠️  Has pending prospects but status is '${c.status}'`);
    }
  }
}

// Check for duplicate campaigns
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 Checking for duplicate campaign names...\n');

const nameCount = new Map();
for (const c of campaigns || []) {
  const count = nameCount.get(c.name) || 0;
  nameCount.set(c.name, count + 1);
}

for (const [name, count] of nameCount.entries()) {
  if (count > 1) {
    console.log(`⚠️  DUPLICATE: "${name}" appears ${count} times`);
    const dupes = campaigns.filter(c => c.name === name);
    for (const d of dupes) {
      console.log(`     - ID: ${d.id}, Status: ${d.status}, Created: ${d.created_at}`);
    }
  }
}

console.log('\n✅ Check complete');
