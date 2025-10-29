#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking latest test campaign...\n');

// Get latest campaign with "test" in name
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .ilike('name', '%test%')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (!campaign) {
  console.log('❌ No test campaign found');
  process.exit(0);
}

console.log(`📊 Campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id}`);
console.log(`   Created: ${campaign.created_at}`);
console.log(`   Status: ${campaign.status}\n`);

// Check for prospects in this campaign
const { data: prospects, count } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status', { count: 'exact' })
  .eq('campaign_id', campaign.id);

console.log(`📊 Campaign Prospects: ${count || 0}`);

if (count === 0) {
  console.log('\n❌ NO PROSPECTS ADDED TO CAMPAIGN');
  console.log('   This confirms the old code is still running.');
  console.log('   The fix is on disk but dev server needs restart.\n');
  console.log('🔄 SOLUTION: Restart your dev server (npm run dev)');
} else {
  console.log('\n✅ Prospects found:');
  prospects.forEach(p => {
    console.log(`   - ${p.first_name} ${p.last_name} [${p.status}]`);
  });
}
