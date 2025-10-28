import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Fixing campaign issues...\n');

// Issue 1: Delete duplicate campaign (keep older one)
console.log('1️⃣ Removing duplicate campaign...\n');

const duplicateToDelete = 'ba20c801-74ad-461f-960f-020d79091973'; // newer one
const { error: deleteError } = await supabase
  .from('campaigns')
  .delete()
  .eq('id', duplicateToDelete);

if (deleteError) {
  console.log(`❌ Error deleting duplicate: ${deleteError.message}`);
} else {
  console.log(`✅ Deleted duplicate campaign: ba20c801-74ad-461f-960f-020d79091973`);
}

// Issue 2: Activate campaigns with pending prospects
console.log('\n2️⃣ Activating campaigns with pending prospects...\n');

const campaignsToActivate = [
  { id: '1aa1af85-3b30-4c01-98a6-a8e5b2f3fa66', name: '20251028-IAI-Mich Startup Canada' },
  { id: '01ae9a4c-17ab-4e49-aa8d-30e56ddfc2da', name: '20251028-IAI-Startup Campaign' },
  { id: '51803ded-bbc9-4564-aefb-c6d11d69f17c', name: '20251028-3AI-SEO search 3' }
];

for (const camp of campaignsToActivate) {
  // First check if has pending prospects
  const { data: pending, error: pendingError } = await supabase
    .from('campaign_prospects')
    .select('id')
    .eq('campaign_id', camp.id)
    .in('status', ['pending', 'approved', 'ready_to_message'])
    .limit(1);

  if (pendingError) {
    console.log(`❌ Error checking ${camp.name}: ${pendingError.message}`);
    continue;
  }

  if (!pending || pending.length === 0) {
    console.log(`⏭️  Skipping ${camp.name} - no pending prospects`);
    continue;
  }

  // Activate campaign
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({ status: 'active' })
    .eq('id', camp.id);

  if (updateError) {
    console.log(`❌ Error activating ${camp.name}: ${updateError.message}`);
  } else {
    console.log(`✅ Activated: ${camp.name}`);
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Final campaign status:\n');

const { data: finalCampaigns } = await supabase
  .from('campaigns')
  .select('name, status, workspaces(name)')
  .order('name');

for (const c of finalCampaigns || []) {
  const icon = c.status === 'active' ? '✅' : '⏸️ ';
  console.log(`  ${icon} ${c.name} (${c.status})`);
}

console.log('\n✅ All issues fixed!');
