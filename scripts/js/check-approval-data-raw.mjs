#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 RAW DATABASE CHECK\n');

// Get the test session we just created
const { data: sessions } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .eq('campaign_name', 'Test Campaign - Do Not Delete')
  .order('created_at', { ascending: false })
  .limit(1);

if (!sessions || sessions.length === 0) {
  console.log('❌ No test session found');
  process.exit(0);
}

const session = sessions[0];
console.log(`📋 Session: ${session.campaign_name}`);
console.log(`   ID: ${session.id}`);
console.log(`   Approved count: ${session.approved_count}`);
console.log(`   Total: ${session.total_prospects}\n`);

// Check prospect_approval_data WITHOUT filters
const { data: allData, error } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .eq('session_id', session.id);

console.log(`📊 Raw prospect_approval_data query:`);
console.log(`   Query: SELECT * WHERE session_id = '${session.id}'`);
console.log(`   Results: ${allData?.length || 0}`);
console.log(`   Error: ${error ? JSON.stringify(error) : 'none'}\n`);

if (allData && allData.length > 0) {
  console.log('✅ Found data:');
  allData.forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.name}`);
    console.log(`   prospect_id: ${p.prospect_id}`);
    console.log(`   approval_status: ${p.approval_status}`);
    console.log(`   session_id: ${p.session_id}`);
    console.log(`   contact: ${JSON.stringify(p.contact)}`);
  });
} else {
  console.log('❌ NO DATA FOUND');
  console.log('\n🔍 Checking if data exists in ANY session...\n');

  const { data: anyData, count } = await supabase
    .from('prospect_approval_data')
    .select('*', { count: 'exact' })
    .limit(5);

  console.log(`   Total records in prospect_approval_data: ${count}`);
  if (anyData && anyData.length > 0) {
    console.log(`   Sample records:`);
    anyData.forEach((p, i) => {
      console.log(`      ${i + 1}. ${p.name} (session: ${p.session_id.substring(0, 8)}...)`);
    });
  }
}
