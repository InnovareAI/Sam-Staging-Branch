#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Debugging Approval Flow\n');

// Get latest approval session
const { data: session } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`📊 Latest Session: ${session.campaign_name}`);
console.log(`   ID: ${session.id}`);
console.log(`   Status: ${session.status}`);
console.log(`   Total prospects: ${session.total_prospects}\n`);

// Check raw_prospects_data (JSONB array)
console.log(`📝 Raw prospect data length: ${session.raw_prospects_data?.length || 0}`);

if (session.raw_prospects_data && session.raw_prospects_data.length > 0) {
  console.log('\n✅ Sample prospect from raw_prospects_data:');
  const sample = session.raw_prospects_data[0];
  console.log(JSON.stringify(sample, null, 2));
}

// Check for prospect_approval_data entries
const { data: approvalData, count } = await supabase
  .from('prospect_approval_data')
  .select('*', { count: 'exact' })
  .eq('session_id', session.id);

console.log(`\n📊 prospect_approval_data entries: ${count || 0}`);

if (count === 0) {
  console.log('\n❌ PROBLEM: No entries in prospect_approval_data!');
  console.log('   This table should be populated when prospects are approved.');
  console.log('   Missing API endpoint or broken flow.');
}
