#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHARISSA_WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861';

console.log('🔍 CHECKING SEND_QUEUE STRUCTURE AND DATA');
console.log('='.repeat(70));

// Get Charissa's campaign IDs
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name')
  .eq('workspace_id', CHARISSA_WORKSPACE_ID);

const campaignIds = campaigns?.map(c => c.id) || [];

console.log(`\nCharissa's campaigns: ${campaignIds.length}`);

// Check send_queue by campaign_id instead of workspace_id
console.log('\n1️⃣ Send queue items by campaign_id (all time)...');
const { data: queueByCampaign, count } = await supabase
  .from('send_queue')
  .select('*', { count: 'exact' })
  .in('campaign_id', campaignIds)
  .limit(20);

console.log(`   Total items: ${count || queueByCampaign?.length || 0}`);

// Show some samples
for (const q of (queueByCampaign || []).slice(0, 10)) {
  console.log(`   - ${q.linkedin_user_id?.slice(0, 30)} | ${q.status} | ${q.scheduled_for}`);
}

// Check if send_queue has workspace_id column
console.log('\n2️⃣ Sample send_queue row structure...');
const { data: sample } = await supabase
  .from('send_queue')
  .select('*')
  .limit(1);

if (sample && sample[0]) {
  console.log('   Columns:', Object.keys(sample[0]));
}

// Get total count across ALL campaigns
console.log('\n3️⃣ Total send_queue items (all workspaces)...');
const { count: totalCount } = await supabase
  .from('send_queue')
  .select('*', { count: 'exact', head: true });

console.log(`   Total: ${totalCount}`);

// Find the oldest send_queue items for Charissa's campaigns
console.log('\n4️⃣ Oldest send_queue items for Charissa...');
const { data: oldest } = await supabase
  .from('send_queue')
  .select('*')
  .in('campaign_id', campaignIds)
  .order('created_at', { ascending: true })
  .limit(5);

for (const q of oldest || []) {
  console.log(`   - Created: ${q.created_at} | Scheduled: ${q.scheduled_for}`);
}

// Check if there's another table for connection requests
console.log('\n5️⃣ Checking for connection-request related tables...');
const tables = [
  'connection_requests',
  'linkedin_connection_requests', 
  'cr_queue',
  'outbound_messages',
  'linkedin_outbound'
];

for (const table of tables) {
  const { error } = await supabase.from(table).select('*').limit(1);
  if (!error) {
    console.log(`   ✓ ${table} EXISTS`);
  }
}

console.log('\n' + '='.repeat(70));
