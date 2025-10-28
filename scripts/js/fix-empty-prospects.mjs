import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const oldCampaignId = '51803ded-bbc9-4564-aefb-c6d11d69f17c';

console.log('🔍 Checking for prospects with empty data in old campaign...\n');

// Get pending prospects from old campaign
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, company_name, status')
  .eq('campaign_id', oldCampaignId)
  .in('status', ['pending', 'approved', 'ready_to_message']);

console.log(`Pending prospects in old campaign: ${prospects?.length || 0}\n`);

if (!prospects || prospects.length === 0) {
  console.log('✅ No pending prospects to check');
  process.exit(0);
}

const emptyIds = [];

for (const p of prospects) {
  const hasName = (p.first_name && p.first_name.trim()) || (p.last_name && p.last_name.trim());
  const hasCompany = p.company_name && p.company_name.trim();

  if (!hasName && !hasCompany) {
    emptyIds.push(p.id);
    console.log(`  ❌ EMPTY: ${p.id} (no name, no company)`);
  } else if (!hasName) {
    console.log(`  ⚠️  ${p.id}: No name (company: ${p.company_name})`);
  } else if (!hasCompany) {
    console.log(`  ⚠️  ${p.id}: No company (name: ${p.first_name} ${p.last_name})`);
  }
}

console.log(`\nFound ${emptyIds.length} prospects with BOTH name AND company missing\n`);

if (emptyIds.length > 0) {
  console.log('Marking them as failed...');

  const { error } = await supabase
    .from('campaign_prospects')
    .update({
      status: 'failed',
      personalization_data: {
        error: 'Missing name AND company data - cannot send connection request',
        marked_at: new Date().toISOString()
      }
    })
    .in('id', emptyIds);

  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log(`✅ Marked ${emptyIds.length} prospects as failed`);
  }
} else {
  console.log('✅ No completely empty prospects found');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Cleanup complete');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
